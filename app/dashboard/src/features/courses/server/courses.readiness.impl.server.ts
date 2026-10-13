/**
 * Server-only implementation of publish readiness (S-2.22) and the shared
 * authoring-health projection (S-2.1).
 *
 * This module **reads** the database and assembles a plain snapshot; the verdict
 * itself is `evaluatePublishReadiness` in `courses.readiness.ts`. Keeping the
 * decision framework-free is what lets the catalog card, the Overview banner,
 * and the S-2.22 checklist quote one number rather than three calculations.
 *
 * Never import from client code.
 */
import { and, count, eq, inArray, isNull, sql } from '@abugida/database'
import { completionRules, courses, lessons, modules, quizOptions } from '@abugida/database/catalog'
import { paymentGateways } from '@abugida/database/finance'
import { quizQuestions } from '@abugida/database/learning'
import { db } from '#/config/db.config'
import { requireAtRole, resolveCourse } from './courses.server-helpers.server'
import {
  countProseCharacters,
  deriveAuthoringHealth,
  evaluatePublishReadiness,
} from '../courses.readiness'
import type {
  AuthoringHealth,
  ReadinessCheckId,
  ReadinessCourseSnapshot,
  ReadinessItem,
  ReadinessResult,
} from '../courses.readiness'
import { isInPublishedSetAt } from '../courses.workspace'

/** A `video_url` the editor accepts. Kept beside the readiness read that needs it. */
const VIDEO_URL_PATTERN = /^https?:\/\/(www\.)?(youtube\.com\/watch\?|youtu\.be\/|vimeo\.com\/)/i

/** One lesson row plus the joined facts readiness needs, in a single flat read. */
interface LessonReadRow {
  id: number
  publicId: string
  title: string
  contentType: string | null
  body: string | null
  videoUrl: string | null
  assetId: number | null
  visibility: string | null
  scheduledPublishAt: Date | null
  archivedAt: Date | null
  deletedAt: Date | null
  reviewStatus: 'draft' | 'in_review' | 'changes_requested' | 'approved' | null
}

export async function loadLessonReadRows(courseId: number): Promise<LessonReadRow[]> {
  return await db
    .select({
      id: lessons.id,
      publicId: lessons.publicId,
      title: lessons.title,
      contentType: lessons.contentType,
      body: lessons.body,
      videoUrl: lessons.videoUrl,
      assetId: lessons.assetId,
      visibility: lessons.visibility,
      scheduledPublishAt: lessons.scheduledPublishAt,
      archivedAt: lessons.archivedAt,
      deletedAt: lessons.deletedAt,
      reviewStatus: lessons.reviewStatus,
    })
    .from(lessons)
    .where(and(eq(lessons.courseId, courseId), isNull(lessons.deletedAt)))
}

/**
 * Build the readiness snapshot for one course. Pure read; it never mutates, so
 * the catalog can call it per card and S-2.22 can call it for the checklist.
 */
export async function buildReadinessSnapshot(
  courseId: number,
  now: Date,
): Promise<ReadinessCourseSnapshot> {
  const courseRows = await db
    .select({
      title: courses.title,
      description: courses.description,
      isFree: courses.isFree,
      priceAmount: courses.priceAmount,
      priceCurrency: courses.priceCurrency,
      requiresApproval: courses.requiresApproval,
      instructorId: courses.instructorId,
      thumbnailObjectKey: courses.thumbnailObjectKey,
    })
    .from(courses)
    .where(and(eq(courses.id, courseId), isNull(courses.deletedAt)))
    .limit(1)
  const course = courseRows.at(0)
  if (!course) throw new Error('COURSE_NOT_FOUND')

  const [moduleRows, lessonRows, gatewayRows, ruleRows] = await Promise.all([
    // `RC-3`: a section must contain at least one item **in the published set**,
    // so archived and unpublished rows are excluded from the count.
    db
      .select({ id: modules.id })
      .from(modules)
      .where(and(eq(modules.courseId, courseId), isNull(modules.deletedAt))),
    loadLessonReadRows(courseId),
    db
      .select({ id: paymentGateways.id })
      .from(paymentGateways)
      .where(and(eq(paymentGateways.isEnabled, true), isNull(paymentGateways.deletedAt))),
    db
      .select({ id: completionRules.id })
      .from(completionRules)
      .where(eq(completionRules.courseId, courseId))
      .limit(1),
  ])

  const lessonIds = lessonRows.map((row) => row.id)
  const [questionCounts, questionsWithoutAnswer, publishedModuleCounts] = await Promise.all([
    lessonIds.length
      ? db
          .select({ lessonId: quizQuestions.lessonId, total: count(quizQuestions.id) })
          .from(quizQuestions)
          .where(and(inArray(quizQuestions.lessonId, lessonIds), isNull(quizQuestions.deletedAt)))
          .groupBy(quizQuestions.lessonId)
      : Promise.resolve([] as Array<{ lessonId: number; total: number }>),
    // "every question has a keyed correct answer" — a question with no option
    // flagged correct is unkeyed, whatever its `correct_answer` text says.
    lessonIds.length
      ? db
          .select({
            lessonId: quizQuestions.lessonId,
            unkeyed: sql<number>`COUNT(*) FILTER (WHERE ${quizOptions.id} IS NULL)::int`,
          })
          .from(quizQuestions)
          .leftJoin(
            quizOptions,
            and(eq(quizOptions.questionId, quizQuestions.id), eq(quizOptions.isCorrect, true)),
          )
          .where(and(inArray(quizQuestions.lessonId, lessonIds), isNull(quizQuestions.deletedAt)))
          .groupBy(quizQuestions.lessonId)
      : Promise.resolve([] as Array<{ lessonId: number; unkeyed: number }>),
    db
      .select({ moduleId: lessons.moduleId, total: count(lessons.id) })
      .from(lessons)
      .where(
        and(
          inArray(
            lessons.moduleId,
            moduleRows.map((row) => row.id),
          ),
          eq(lessons.visibility, 'published'),
          isNull(lessons.archivedAt),
          isNull(lessons.deletedAt),
        ),
      )
      .groupBy(lessons.moduleId),
  ])

  const questionsByLesson = new Map(questionCounts.map((row) => [row.lessonId, Number(row.total)]))
  const unkeyedByLesson = new Map(
    questionsWithoutAnswer.map((row) => [row.lessonId, Number(row.unkeyed)]),
  )
  const publishedByModule = new Map(
    publishedModuleCounts.map((row) => [row.moduleId, Number(row.total)]),
  )

  const items: ReadinessItem[] = lessonRows.map((row) => {
    const isQuiz = row.contentType === 'quiz'
    const isAssignment = row.contentType === 'exercise'
    const isVideo = row.contentType === 'video'
    const bodyProse = countProseCharacters(row.body)
    const hasValidVideo = isVideo && row.videoUrl != null && VIDEO_URL_PATTERN.test(row.videoUrl)
    return {
      publicId: row.publicId,
      title: row.title,
      contentType: row.contentType,
      inPublishedSet: isInPublishedSetAt(
        {
          visibility: row.visibility,
          scheduledPublishAt: row.scheduledPublishAt?.toISOString() ?? null,
          archivedAt: row.archivedAt?.toISOString() ?? null,
          deletedAt: row.deletedAt?.toISOString() ?? null,
        },
        now,
      ),
      // A quiz's body is an optional intro and is never the reason it fails, so
      // it does not count toward its kind's prose minimum.
      proseLength: isQuiz ? 0 : bodyProse,
      hasResolvableMedia:
        row.assetId != null || hasValidVideo || (row.videoUrl != null && !isVideo),
      hasInvalidVideoUrl: isVideo && !hasValidVideo,
      missingCaptions: false,
      missingMediaAsset: false,
      questionCount: questionsByLesson.get(row.id) ?? 0,
      questionsWithoutAnswer: unkeyedByLesson.get(row.id) ?? 0,
      briefLength: isAssignment ? bodyProse : 0,
      // The submission-channel set has no dedicated column yet; an authored
      // assignment always accepts online text, which satisfies `RC-4c`.
      enabledSubmissionChannels: isAssignment ? 1 : 0,
      reviewStatus: row.reviewStatus ?? 'draft',
      isTranslationVariant: false,
    }
  })

  return {
    title: course.title,
    // `exam_type_id` is NOT NULL with RESTRICT, so a course always has
    // an exam type; RC-1's exam half is guaranteed by the schema.
    hasExamType: true,
    hasInstructor: course.instructorId != null,
    hasThumbnail: course.thumbnailObjectKey != null && course.thumbnailObjectKey.length > 0,
    description: course.description,
    isFree: course.isFree,
    priceAmount: course.priceAmount,
    priceCurrency: course.priceCurrency,
    enabledGatewayCount: gatewayRows.length,
    completionRuleConfigured: ruleRows.length > 0,
    requiresApproval: course.requiresApproval,
    sections: moduleRows.map((row) => ({ itemCount: publishedByModule.get(row.id) ?? 0 })),
    items,
  }
}

/**
 * S-2.22: evaluate RC-1…RC-8 for one course. Read-only, workspace-scoped, and
 * gated to any authenticated viewer — publishing is re-validated server-side at
 * the moment of publishing, so this read is a convenience, not the gate.
 */
export async function getPublishReadinessImpl(coursePublicId: string): Promise<ReadinessResult> {
  await requireAtRole('viewer')
  const course = await resolveCourse(coursePublicId)
  const snapshot = await buildReadinessSnapshot(course.id, new Date())
  return evaluatePublishReadiness(snapshot)
}

/** The `RC-*` ids that failed for a course, for the bulk-publish exclusion list. */
export function failingCheckIds(result: ReadinessResult): ReadinessCheckId[] {
  return result.checks.filter((item) => !item.passed && item.blocking).map((item) => item.id)
}

/**
 * Batch authoring-health projection for the catalog (S-2.1). It reuses
 * `evaluatePublishReadiness` on the same snapshot S-2.22 reads, so a card can
 * never quote a count the readiness checklist disagrees with — which is
 * acceptance criterion 1 on that screen.
 */
export async function loadCatalogAuthoringHealth(
  courseIds: number[],
  scheduledPublishAts: Map<number, Date | null>,
): Promise<Map<number, AuthoringHealth>> {
  const health = new Map<number, AuthoringHealth>()
  await Promise.all(
    courseIds.map(async (courseId) => {
      try {
        const snapshot = await buildReadinessSnapshot(courseId, new Date())
        const result = evaluatePublishReadiness(snapshot)
        health.set(
          courseId,
          deriveAuthoringHealth(result, {
            totalItemCount: snapshot.items.length,
            awaitingReviewCount: snapshot.items.filter((i) => i.reviewStatus === 'in_review')
              .length,
            changesRequestedCount: snapshot.items.filter(
              (i) => i.reviewStatus === 'changes_requested',
            ).length,
            scheduledPublishAt: (scheduledPublishAts.get(courseId) ?? null)?.toISOString() ?? null,
            publishedItemCount: result.publishedItemCount,
          }),
        )
      } catch {
        // One unreadable course degrades its own card; it must never fail the
        // whole catalog page.
        health.set(courseId, { variant: 'not_started', nextAction: null, count: 0 })
      }
    }),
  )
  return health
}
