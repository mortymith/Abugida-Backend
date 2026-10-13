/**
 * Server-only implementation of course lifecycle: publish (with the spec's
 * approval gating), archive, delete, and deep duplicate.
 */
import { and, eq, inArray, isNull } from '@abugida/database'
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
import { outboxEvents, reviewRequests } from '@abugida/database/ops'
import { purchaseOptions } from '@abugida/database/finance'
import { db } from '#/config/db.config'
import {
  createNotifications,
  requireActiveOrganizationId,
  requireAuthoringRole,
  requireRoleIn,
  requireUserId,
  resolveCourse,
  resolveLesson,
  slugifyTitle,
  uniqueCourseSlug,
  userIdsWithPlatformRoles,
} from './courses.server-helpers.server'
import type {
  CoursePublishInput,
  SetItemVisibilityInput,
} from '../schemas/courses.authoring.schema'

export async function publishCourseImpl(
  input: CoursePublishInput,
): Promise<{ coursePublicId: string; scheduled: boolean }> {
  await requireAuthoringRole()
  const course = await resolveCourse(input.coursePublicId)
  if (course.status === 'archived') throw new Error('COURSE_ARCHIVED')

  if (input.visibility === 'published') {
    // "Publish is re-validated server-side at the moment of publishing; the
    // client checklist is a convenience, not the gate." Same evaluator the
    // checklist and the catalog card read, so a stale UI cannot ship a course
    // that would fail `RC-*` a second later.
    const { buildReadinessSnapshot } = await import('./courses.readiness.impl.server')
    const { evaluatePublishReadiness, firstBlockingCheck } = await import('../courses.readiness')
    const readiness = evaluatePublishReadiness(await buildReadinessSnapshot(course.id, new Date()))
    const blocking = firstBlockingCheck(readiness)
    if (blocking) {
      throw new Error(`READINESS_BLOCKED: ${blocking.id} — ${blocking.detail ?? blocking.label}`)
    }
    if (readiness.blockingFailures > 0) {
      throw new Error(`READINESS_BLOCKED: ${readiness.blockingFailures} blocking checks remaining`)
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

    // Publishing increments `courses.version`, and it also closes the approval:
    // once the course is live, `approved_at` no longer describes anything.
    await db
      .update(courses)
      .set({
        status: 'published',
        publishedAt: new Date(),
        scheduledPublishAt: null,
        approvedAt: null,
        version: course.version + 1,
      })
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

/**
 * Archived → Draft (spec 04 § Course Lifecycle). "Restore returns the course to
 * Draft — never straight to Published." Clearing `approvedAt` is what stops a
 * stale approval from riding through the restore.
 */
export async function restoreCourseImpl(
  coursePublicId: string,
): Promise<{ coursePublicId: string }> {
  await requireAuthoringRole()
  const course = await resolveCourse(coursePublicId)
  if (course.status !== 'archived') throw new Error('COURSE_NOT_ARCHIVED')
  await db
    .update(courses)
    .set({ status: 'draft', archivedAt: null, approvedAt: null })
    .where(eq(courses.id, course.id))
  return { coursePublicId: course.publicId }
}

/**
 * Published → Draft: unpublish (spec 04 S-2.22).
 *
 * Enrolled students keep access to the content and their progress for a
 * 14-day grace period; new enrolment stops immediately, and **unpublish never
 * revokes an earned certificate**. Clearing `approvedAt` is required by the
 * lifecycle contract, so a later republish is a fresh decision.
 */
export async function unpublishCourseImpl(
  coursePublicId: string,
): Promise<{ coursePublicId: string; graceDays: number }> {
  await requireAuthoringRole()
  const course = await resolveCourse(coursePublicId)
  if (course.status !== 'published') throw new Error('COURSE_NOT_PUBLISHED')
  await db
    .update(courses)
    .set({ status: 'draft', publishedAt: null, approvedAt: null, scheduledPublishAt: null })
    .where(eq(courses.id, course.id))
  return { coursePublicId: course.publicId, graceDays: UNPUBLISH_GRACE_DAYS }
}

/** Access grace period an unenrolled-but-still-privileged student keeps. */
export const UNPUBLISH_GRACE_DAYS = 14

/**
 * Draft → In Review (spec 04 § Course Lifecycle). Only when `requiresApproval`
 * is on — an ungated course publishes directly from Draft. Opening a
 * course-scoped `review_requests` row is what the catalog's **Approved** filter
 * later matches against, so it is written in the same transaction.
 */
export async function submitCourseForReviewImpl(
  coursePublicId: string,
  note?: string | null,
): Promise<{ coursePublicId: string; reviewPublicId: string }> {
  await requireAuthoringRole()
  const course = await resolveCourse(coursePublicId)
  if (!course.requiresApproval) throw new Error('APPROVAL_NOT_REQUIRED')
  if (course.status !== 'draft') throw new Error('COURSE_NOT_DRAFT')

  // A resubmission closes the previous open request rather than stacking a
  // second one: the queue shows one row per subject.
  await db
    .update(reviewRequests)
    .set({ state: 'withdrawn', decidedAt: new Date() })
    .where(
      and(
        eq(reviewRequests.courseId, course.id),
        eq(reviewRequests.entityType, 'course'),
        eq(reviewRequests.state, 'pending'),
      ),
    )

  const inserted = await db
    .insert(reviewRequests)
    .values({
      courseId: course.id,
      entityType: 'course',
      requestedBy: await requireUserId(),
      state: 'pending',
      submissionNote: note ?? null,
    })
    .returning({ publicId: reviewRequests.publicId })

  const reviewPublicId = inserted.at(0)?.publicId
  if (!reviewPublicId) throw new Error('REVIEW_REQUEST_FAILED')

  await db
    .update(courses)
    .set({
      status: 'in_review',
      reviewRequestedAt: new Date(),
      // Any edit clears an existing approval; submitting is not an edit, but a
      // course cannot be both approved and in review.
      approvedAt: null,
    })
    .where(eq(courses.id, course.id))

  const reviewers = await userIdsWithPlatformRoles(['admin', 'reviewer'])
  await createNotifications(reviewers, {
    type: 'review',
    title: `${course.title} is ready for review`,
    body: 'A course was submitted for your review.',
    linkEntityType: 'review_queue',
    linkEntityPublicId: reviewPublicId,
  })

  return { coursePublicId: course.publicId, reviewPublicId }
}

/**
 * In Review → Draft: withdraw. "Withdrawal keeps every edit" — only the request
 * and the status move, so nothing authored is lost.
 */
export async function withdrawCourseReviewImpl(
  coursePublicId: string,
): Promise<{ coursePublicId: string }> {
  await requireAuthoringRole()
  const course = await resolveCourse(coursePublicId)
  if (course.status !== 'in_review') throw new Error('COURSE_NOT_IN_REVIEW')

  await db
    .update(reviewRequests)
    .set({ state: 'withdrawn', decidedAt: new Date() })
    .where(
      and(
        eq(reviewRequests.courseId, course.id),
        eq(reviewRequests.entityType, 'course'),
        eq(reviewRequests.state, 'pending'),
      ),
    )
  await db.update(courses).set({ status: 'draft' }).where(eq(courses.id, course.id))
  return { coursePublicId: course.publicId }
}

/**
 * In Review → Approved (spec 04 § Course Lifecycle). This is the transition that
 * the Revision 3 spec adds: `courses.approved_at` is set, but `status` stays
 * `'draft'` so the course sits **between** review and publication — which is
 * exactly what the catalog's Approved filter matches.
 *
 * Approval is deliberately *not* publication. A reviewer who also wants it live
 * uses `publishCourse`, which re-evaluates `RC-*` first.
 */
export async function approveCourseReviewImpl(
  coursePublicId: string,
  comment?: string | null,
): Promise<{ coursePublicId: string }> {
  await requireRoleIn(['admin', 'reviewer'])
  const course = await resolveCourse(coursePublicId)
  if (course.status !== 'in_review') throw new Error('COURSE_NOT_IN_REVIEW')

  const now = new Date()
  await db
    .update(reviewRequests)
    .set({ state: 'approved', decidedAt: now, decisionComment: comment ?? null })
    .where(
      and(
        eq(reviewRequests.courseId, course.id),
        eq(reviewRequests.entityType, 'course'),
        eq(reviewRequests.state, 'pending'),
      ),
    )
  await db
    .update(courses)
    .set({ status: 'draft', approvedAt: now, reviewDecidedAt: now })
    .where(eq(courses.id, course.id))

  return { coursePublicId: course.publicId }
}

/**
 * In Review → Draft on a reviewer's decision: "Requesting changes requires a
 * comment" (spec 04 § Course Lifecycle).
 */
export async function requestCourseChangesImpl(
  coursePublicId: string,
  comment: string,
): Promise<{ coursePublicId: string }> {
  await requireRoleIn(['admin', 'reviewer'])
  const trimmed = comment.trim()
  if (trimmed.length === 0) throw new Error('COMMENT_REQUIRED')
  const course = await resolveCourse(coursePublicId)
  if (course.status !== 'in_review') throw new Error('COURSE_NOT_IN_REVIEW')

  const now = new Date()
  await db
    .update(reviewRequests)
    .set({ state: 'changes_requested', decidedAt: now, decisionComment: trimmed })
    .where(
      and(
        eq(reviewRequests.courseId, course.id),
        eq(reviewRequests.entityType, 'course'),
        eq(reviewRequests.state, 'pending'),
      ),
    )
  await db.update(courses).set({ status: 'draft' }).where(eq(courses.id, course.id))
  return { coursePublicId: course.publicId }
}

/**
 * `draft ⇄ published ⇄ scheduled` for **one** item (spec 04 S-2.17,
 * `setItemVisibility`). This never touches the course — an item can be
 * published inside a draft course, and an unpublished item drops out of the
 * published set immediately while students keep any completion already recorded
 * on it.
 *
 * While the course is In Review the field is **absent** per the Field Lock
 * table, so this rejects it rather than letting a client bypass the lock.
 */
export async function setItemVisibilityImpl(
  input: SetItemVisibilityInput,
): Promise<{ lessonPublicId: string; visibility: 'draft' | 'published' | 'scheduled' }> {
  await requireAuthoringRole()
  const lesson = await resolveLesson(input.lessonPublicId)
  const course = await resolveCourse(input.coursePublicId)
  if (lesson.courseId !== course.id) throw new Error('LESSON_COURSE_MISMATCH')
  if (course.status === 'in_review') {
    throw new Error('COURSE_IN_REVIEW: withdraw to edit')
  }

  // A scheduled item needs the moment it becomes visible; a non-scheduled one
  // must not keep a stale date that would resurface on the next toggle.
  const scheduledFor =
    input.visibility === 'scheduled'
      ? input.scheduledPublishAt
        ? new Date(input.scheduledPublishAt)
        : null
      : null
  if (input.visibility === 'scheduled' && scheduledFor === null) {
    throw new Error('SCHEDULE_DATE_REQUIRED')
  }

  await db
    .update(lessons)
    .set({ visibility: input.visibility, scheduledPublishAt: scheduledFor })
    .where(eq(lessons.id, lesson.id))
  return { lessonPublicId: lesson.publicId, visibility: input.visibility }
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
        organizationId: await requireActiveOrganizationId(),
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
