/**
 * Server-only implementation of course lifecycle: publish (with the spec's
 * approval gating), archive, delete, and deep duplicate.
 */
import { and, eq, inArray, isNull, sql } from '@abugida/database'
import {
  courses,
  lessons,
  modules,
  quizzes,
  quizOptions,
  courseDiscounts,
  completionRules,
  certificateTemplates,
} from '@abugida/database/catalog'
import { quizQuestions, enrollments } from '@abugida/database/learning'
import { outboxEvents } from '@abugida/database/ops'
import { purchaseOptions } from '@abugida/database/finance'
import { db } from '#/config/db.config'
import {
  createNotifications,
  requireAuthoringRole,
  resolveCourse,
  slugifyTitle,
  uniqueCourseSlug,
  userIdsWithPlatformRoles,
} from './courses.server-helpers.server'
import type { CoursePublishInput } from '../schemas/courses.authoring.schema'

export async function publishCourseImpl(
  input: CoursePublishInput,
): Promise<{ coursePublicId: string; scheduled: boolean }> {
  await requireAuthoringRole()
  const course = await resolveCourse(input.coursePublicId)
  if (course.status === 'archived') throw new Error('COURSE_ARCHIVED')

  if (input.visibility === 'published') {
    // Spec S-2.5 checks: curriculum completeness + approval gating.
    const counts = await db
      .select({
        moduleCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${modules}
          WHERE ${modules.courseId} = ${course.id} AND ${modules.deletedAt} IS NULL
        )`,
        lessonCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${lessons}
          WHERE ${lessons.courseId} = ${course.id} AND ${lessons.deletedAt} IS NULL
        )`,
      })
      .from(courses)
      .where(eq(courses.id, course.id))
    const row = counts.at(0)
    if (!row || Number(row.moduleCount) < 1 || Number(row.lessonCount) < 1) {
      throw new Error(
        'CURRICULUM_INCOMPLETE: add at least 1 module with 1 lesson before publishing',
      )
    }

    if (course.requiresApproval) {
      const unapproved = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(lessons)
        .where(
          and(
            eq(lessons.courseId, course.id),
            isNull(lessons.deletedAt),
            sql`${lessons.reviewStatus} <> 'approved'`,
          ),
        )
      if (Number(unapproved.at(0)?.count ?? 0) > 0) {
        throw new Error(
          'LESSONS_NOT_APPROVED: every lesson must be approved before this course can publish',
        )
      }
    }

    if (input.releaseMode === 'scheduled' && input.scheduledFor) {
      const when = new Date(input.scheduledFor)
      await db
        .update(courses)
        .set({ status: 'draft', scheduledPublishAt: when, publishedAt: null })
        .where(eq(courses.id, course.id))
      // Durable hand-off to the platform's async processing (outbox pattern).
      await db.insert(outboxEvents).values({
        aggregateType: 'course',
        aggregateId: String(course.id),
        eventType: 'course.publish_scheduled',
        payload: { coursePublicId: course.publicId, scheduledFor: when.toISOString() },
      })
      return { coursePublicId: course.publicId, scheduled: true }
    }

    await db
      .update(courses)
      .set({ status: 'published', publishedAt: new Date(), scheduledPublishAt: null })
      .where(eq(courses.id, course.id))

    // Spec S-2.5 notification toggles.
    if (input.notifyStudents) {
      const enrolled = await db
        .select({ studentId: enrollments.studentId })
        .from(enrollments)
        .where(and(eq(enrollments.courseId, course.id), isNull(enrollments.deletedAt)))
        .groupBy(enrollments.studentId)
      await createNotifications(
        enrolled.map((enrolledRow) => enrolledRow.studentId),
        {
          type: 'publish',
          title: `New content: ${course.title}`,
          body: 'A course you are enrolled in was just published with fresh content.',
          linkEntityType: 'course',
          linkEntityPublicId: course.publicId,
        },
      )
    }
    if (input.notifySubscribers) {
      const admins = await userIdsWithPlatformRoles(['admin', 'editor'])
      await createNotifications(admins, {
        type: 'system',
        title: `${course.title} is now published`,
        body: 'Subscribers announcement trigger fired for this course.',
        linkEntityType: 'course',
        linkEntityPublicId: course.publicId,
      })
    }

    return { coursePublicId: course.publicId, scheduled: false }
  }

  await db
    .update(courses)
    .set({ status: 'draft', scheduledPublishAt: null })
    .where(eq(courses.id, course.id))
  return { coursePublicId: course.publicId, scheduled: false }
}

export async function archiveCourseImpl(
  coursePublicId: string,
): Promise<{ coursePublicId: string }> {
  await requireAuthoringRole()
  const course = await resolveCourse(coursePublicId)
  await db.update(courses).set({ status: 'archived' }).where(eq(courses.id, course.id))
  return { coursePublicId: course.publicId }
}

export async function deleteCourseImpl(coursePublicId: string): Promise<{ ok: true }> {
  await requireAuthoringRole()
  const course = await resolveCourse(coursePublicId)
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(lessons)
      .set({ deletedAt: now })
      .where(and(eq(lessons.courseId, course.id), isNull(lessons.deletedAt)))
    await tx
      .update(modules)
      .set({ deletedAt: now })
      .where(and(eq(modules.courseId, course.id), isNull(modules.deletedAt)))
    await tx.update(courses).set({ deletedAt: now }).where(eq(courses.id, course.id))
  })
  return { ok: true }
}

export async function duplicateCourseImpl(
  sourcePublicId: string,
): Promise<{ coursePublicId: string }> {
  const userId = await requireAuthoringRole()
  const source = await resolveCourse(sourcePublicId)

  const title = `${source.title} (copy)`.slice(0, 300)
  const slug = await uniqueCourseSlug(slugifyTitle(title))

  const newCourse = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(courses)
      .values({
        title,
        slug,
        description: source.description,
        examTypeId: source.examTypeId,
        instructorId: userId,
        courseType: source.courseType,
        level: source.level,
        thumbnailObjectKey: source.thumbnailObjectKey,
        isFree: source.isFree,
        pricingModel: source.pricingModel,
        priceAmount: source.priceAmount,
        priceCurrency: source.priceCurrency,
        enrollmentStartAt: source.enrollmentStartAt,
        enrollmentEndAt: source.enrollmentEndAt,
        requiresApproval: source.requiresApproval,
        status: 'draft',
      })
      .returning()
    const created = inserted.at(0)
    if (!created) throw new Error('COURSE_CREATE_FAILED')

    const sourceModules = await tx
      .select()
      .from(modules)
      .where(and(eq(modules.courseId, source.id), isNull(modules.deletedAt)))
      .orderBy(modules.sortOrder)

    const moduleIdMap = new Map<number, number>()
    const lessonMap = new Map<
      number,
      { id: number; moduleId: number; quizPublicId: string | null }
    >()

    for (const module of sourceModules) {
      const insertedModule = await tx
        .insert(modules)
        .values({
          courseId: created.id,
          instructorId: userId,
          title: module.title,
          description: module.description,
          sortOrder: module.sortOrder,
          estimatedDurationMinutes: module.estimatedDurationMinutes,
          isPreviewAvailable: module.isPreviewAvailable,
        })
        .returning({ id: modules.id })
      const newModuleId = insertedModule.at(0)!.id
      moduleIdMap.set(module.id, newModuleId)

      const sourceLessons = await tx
        .select()
        .from(lessons)
        .where(and(eq(lessons.moduleId, module.id), isNull(lessons.deletedAt)))
        .orderBy(lessons.sortOrder)

      for (const lesson of sourceLessons) {
        const insertedLesson = await tx
          .insert(lessons)
          .values({
            moduleId: newModuleId,
            courseId: created.id,
            instructorId: userId,
            title: lesson.title,
            description: lesson.description,
            contentType: lesson.contentType,
            body: lesson.body,
            tags: lesson.tags,
            videoUrl: lesson.videoUrl,
            sortOrder: lesson.sortOrder,
            reviewStatus: 'draft',
            fileObjectKey: lesson.fileObjectKey,
            durationSeconds: lesson.durationSeconds,
          })
          .returning({ id: lessons.id })
        lessonMap.set(lesson.id, {
          id: insertedLesson.at(0)!.id,
          moduleId: newModuleId,
          quizPublicId: null,
        })
      }
    }

    // Copy quiz settings + questions + options for lessons that have them.
    const sourceLessonIds = Array.from(lessonMap.keys())
    if (sourceLessonIds.length) {
      const sourceQuizzes = await tx
        .select()
        .from(quizzes)
        .where(and(inArray(quizzes.lessonId, sourceLessonIds), isNull(quizzes.deletedAt)))
      for (const quiz of sourceQuizzes) {
        const targetLesson = lessonMap.get(quiz.lessonId)
        if (!targetLesson) continue
        const insertedQuiz = await tx
          .insert(quizzes)
          .values({
            courseId: created.id,
            lessonId: targetLesson.id,
            title: quiz.title,
            passingScorePercent: quiz.passingScorePercent,
            timeLimitMinutes: quiz.timeLimitMinutes,
            maxAttempts: quiz.maxAttempts,
            isPublished: false,
          })
          .returning({ publicId: quizzes.publicId })
        const quizPublicId = insertedQuiz.at(0)!.publicId
        targetLesson.quizPublicId = quizPublicId

        const sourceQuestions = await tx
          .select()
          .from(quizQuestions)
          .where(and(eq(quizQuestions.lessonId, quiz.lessonId), isNull(quizQuestions.deletedAt)))
          .orderBy(quizQuestions.questionIndex)
        let questionIndex = 0
        for (const question of sourceQuestions) {
          const insertedQuestion = await tx
            .insert(quizQuestions)
            .values({
              lessonId: targetLesson.id,
              questionIndex,
              questionType: question.questionType,
              points: question.points,
              questionText: question.questionText,
              correctAnswer: question.correctAnswer,
              explanation: question.explanation,
            })
            .returning({ id: quizQuestions.id })
          const newQuestionId = insertedQuestion.at(0)?.id
          questionIndex += 1
          if (!newQuestionId) continue
          const sourceOptionRows = await tx
            .select()
            .from(quizOptions)
            .where(and(eq(quizOptions.questionId, question.id), isNull(quizOptions.deletedAt)))
            .orderBy(quizOptions.optionIndex)
          for (const [optionIndex, option] of sourceOptionRows.entries()) {
            await tx.insert(quizOptions).values({
              questionId: newQuestionId,
              optionIndex,
              optionText: option.optionText,
              isCorrect: option.isCorrect,
            })
          }
        }
      }
    }

    // Copy discounts + purchase options + completion/certificate config.
    const sourceDiscounts = await tx
      .select()
      .from(courseDiscounts)
      .where(and(eq(courseDiscounts.courseId, source.id), eq(courseDiscounts.isActive, true)))
    for (const discount of sourceDiscounts) {
      await tx.insert(courseDiscounts).values({
        courseId: created.id,
        kind: discount.kind,
        percentage: discount.percentage,
        endsAt: discount.endsAt,
        minEnrollments: discount.minEnrollments,
      })
    }

    const sourceOptions = await tx
      .select()
      .from(purchaseOptions)
      .where(and(eq(purchaseOptions.courseId, source.id), eq(purchaseOptions.isActive, true)))
    for (const option of sourceOptions) {
      await tx.insert(purchaseOptions).values({
        courseId: created.id,
        paymentGatewayId: option.paymentGatewayId,
        platform: option.platform,
        productId: option.productId,
        displayName: option.displayName,
        durationDays: option.durationDays,
        priceAmount: option.priceAmount,
        priceCurrency: option.priceCurrency,
      })
    }

    const sourceRule = await tx
      .select()
      .from(completionRules)
      .where(eq(completionRules.courseId, source.id))
      .limit(1)
    if (sourceRule.at(0)) {
      const rule = sourceRule.at(0)!
      await tx.insert(completionRules).values({
        courseId: created.id,
        rule: rule.rule,
        minPercent: rule.minPercent,
        autoIssue: rule.autoIssue,
      })
    }

    const sourceCertificate = await tx
      .select()
      .from(certificateTemplates)
      .where(eq(certificateTemplates.courseId, source.id))
      .limit(1)
    if (sourceCertificate.at(0)) {
      const template = sourceCertificate.at(0)!
      await tx.insert(certificateTemplates).values({
        courseId: created.id,
        title: template.title,
        showStudentName: template.showStudentName,
        showCourseTitle: template.showCourseTitle,
        showCompletionDate: template.showCompletionDate,
        showSignature: template.showSignature,
        signatureObjectKey: template.signatureObjectKey,
        signatureLabel: template.signatureLabel,
        notes: template.notes,
      })
    }

    return created
  })

  return { coursePublicId: newCourse.publicId }
}
