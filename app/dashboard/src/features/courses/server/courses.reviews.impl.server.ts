/**
 * Server-only implementation of S-2.14 Review & Approval Queue.
 */
import { and, asc, eq, inArray, isNull, sql } from '@abugida/database'
import { courses, lessons, quizzes } from '@abugida/database/catalog'
import { quizQuestions } from '@abugida/database/learning'
import { reviewRequests } from '@abugida/database/ops'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import {
  createNotifications,
  requireAuthoringRole,
  requireRoleIn,
  requireActiveOrganizationId,
  resolveCourse,
  resolveLesson,
  userIdsWithPlatformRoles,
} from './courses.server-helpers.server'
import { REVIEW_DECISION_ROLES } from '#/features/auth/auth.roles'
import { applyReviewDecision } from '../courses.review-state'
import type { ReviewDecisionInput, ReviewQueueQuery } from '../schemas/courses.workflow.schema'
import type { PendingReviewCounts, ReviewLessonPreview, ReviewQueueItem } from '../courses.types'

const requester = users

export async function getReviewQueueImpl(data: ReviewQueueQuery): Promise<ReviewQueueItem[]> {
  await requireRoleIn(['admin', 'reviewer'])

  // Scoped to the active workspace: the queue shows this workspace's review
  // work, and every row in it belongs to a course the user can open.
  const filters = [
    eq(reviewRequests.state, data.state),
    eq(courses.organizationId, await requireActiveOrganizationId()),
  ]
  if (data.coursePublicId) {
    const course = await resolveCourse(data.coursePublicId)
    filters.push(eq(reviewRequests.courseId, course.id))
  }

  const decider = users
  const rows = await db
    .select({
      review: reviewRequests,
      lessonTitle: lessons.title,
      lessonPublicId: lessons.publicId,
      courseTitle: courses.title,
      coursePublicId: courses.publicId,
      requesterName: requester.name,
    })
    .from(reviewRequests)
    .innerJoin(lessons, eq(lessons.id, reviewRequests.lessonId))
    .innerJoin(courses, eq(courses.id, reviewRequests.courseId))
    .innerJoin(requester, eq(requester.id, reviewRequests.requestedBy))
    .where(and(...filters))
    .orderBy(asc(reviewRequests.submittedAt))
    .limit(200)

  const decidedByIds = rows
    .map((row) => row.review.decidedBy)
    .filter((id): id is string => id != null)
  const deciderRows = decidedByIds.length
    ? await db
        .select({ id: decider.id, name: decider.name })
        .from(decider)
        .where(inArray(decider.id, decidedByIds))
    : []
  const deciderNames = new Map(deciderRows.map((row) => [row.id, row.name]))

  return rows.map((row) => ({
    reviewPublicId: row.review.publicId,
    lessonPublicId: row.lessonPublicId,
    lessonTitle: row.lessonTitle,
    coursePublicId: row.coursePublicId,
    courseTitle: row.courseTitle,
    requesterName: row.requesterName,
    state: row.review.state,
    submissionNote: row.review.submissionNote,
    decisionComment: row.review.decisionComment,
    decidedByName: row.review.decidedBy ? (deciderNames.get(row.review.decidedBy) ?? null) : null,
    submittedAt: row.review.submittedAt.toISOString(),
    decidedAt: row.review.decidedAt?.toISOString() ?? null,
  }))
}

export async function getReviewLessonPreviewImpl(
  lessonPublicId: string,
): Promise<ReviewLessonPreview> {
  await requireRoleIn(['admin', 'reviewer'])
  const lesson = await resolveLesson(lessonPublicId)

  const quizRows = await db
    .select({ publicId: quizzes.publicId, title: quizzes.title })
    .from(quizzes)
    .where(and(eq(quizzes.lessonId, lesson.id), isNull(quizzes.deletedAt)))
    .limit(1)
  const quiz = quizRows.at(0)

  const questionRows = quiz
    ? await db
        .select({
          questionText: quizQuestions.questionText,
          questionType: quizQuestions.questionType,
          correctAnswer: quizQuestions.correctAnswer,
        })
        .from(quizQuestions)
        .where(and(eq(quizQuestions.lessonId, lesson.id), isNull(quizQuestions.deletedAt)))
        .orderBy(asc(quizQuestions.questionIndex))
    : []

  return {
    lessonPublicId: lesson.publicId,
    lessonTitle: lesson.title,
    body: lesson.body,
    videoUrl: lesson.videoUrl,
    contentType: lesson.contentType,
    durationMinutes:
      lesson.durationSeconds == null ? null : Math.round(lesson.durationSeconds / 60),
    quiz: quiz
      ? {
          title: quiz.title,
          questions: questionRows.map((question) => ({
            questionText: question.questionText,
            options:
              question.questionType === 'short_answer'
                ? [`Answer key: ${question.correctAnswer}`]
                : [
                    `Correct: ${question.correctAnswer}`,
                    question.questionType === 'true_false' ? 'False' : 'Other options',
                  ],
          })),
        }
      : null,
  }
}

export async function submitForReviewImpl(input: {
  lessonPublicId: string
  note?: string
}): Promise<{ ok: true }> {
  const userId = await requireAuthoringRole()
  const lesson = await resolveLesson(input.lessonPublicId)
  const course = await resolveCourseById(lesson.courseId)

  if (!course.requiresApproval) {
    throw new Error('APPROVAL_NOT_REQUIRED: this course does not use the approval workflow')
  }
  if (lesson.reviewStatus !== 'draft' && lesson.reviewStatus !== 'changes_requested') {
    throw new Error(`INVALID_STATE: lesson is already "${lesson.reviewStatus}"`)
  }

  await db.transaction(async (tx) => {
    await tx.insert(reviewRequests).values({
      courseId: course.id,
      lessonId: lesson.id,
      requestedBy: userId,
      state: 'pending',
      submissionNote: input.note?.trim() || null,
    })
    await tx.update(lessons).set({ reviewStatus: 'in_review' }).where(eq(lessons.id, lesson.id))
  })

  const reviewers = await userIdsWithPlatformRoles(['admin', 'reviewer'])
  await createNotifications(
    reviewers.filter((id) => id !== userId),
    {
      type: 'review',
      title: `Review requested: ${lesson.title}`,
      body: `${course.title} — submitted for approval.`,
      linkEntityType: 'review_queue',
      linkEntityPublicId: course.publicId,
    },
  )
  return { ok: true }
}

export async function decideReviewImpl(input: ReviewDecisionInput): Promise<{ ok: true }> {
  const userId = await requireRoleIn(REVIEW_DECISION_ROLES)

  const rows = await db
    .select()
    .from(reviewRequests)
    .where(and(eq(reviewRequests.publicId, input.reviewPublicId), isNull(reviewRequests.decidedAt)))
    .limit(1)
  const request = rows.at(0)
  if (!request) throw new Error('REVIEW_NOT_FOUND')
  if (request.state !== 'pending') throw new Error('REVIEW_ALREADY_DECIDED')

  /**
   * Revision 2 widened `review_requests` to serve BOTH whole courses and
   * individual curriculum items (spec 00 §2.6). `lessonId` is now nullable and
   * `entityType` discriminates the two: a `course` request has no lesson. This
   * path decides a curriculum item's review, so it must reject a course-level
   * request outright — `eq(lessons.id, null)` never matches and would otherwise
   * surface as a misleading LESSON_NOT_FOUND.
   */
  if (request.entityType !== 'item' || request.lessonId === null) {
    throw new Error('REVIEW_NOT_A_CURRICULUM_ITEM')
  }

  const lessonRows = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, request.lessonId))
    .limit(1)
  const lesson = lessonRows.at(0)
  if (!lesson) throw new Error('LESSON_NOT_FOUND')

  // Spec state machine: approve → approved, request_changes → changes_requested,
  // reject → back to draft for rework.
  const transition = applyReviewDecision(lesson.reviewStatus ?? 'draft', input.decision)
  const nextState =
    input.decision === 'approve'
      ? 'approved'
      : input.decision === 'request_changes'
        ? 'changes_requested'
        : 'rejected'

  await db.transaction(async (tx) => {
    await tx
      .update(reviewRequests)
      .set({
        state: nextState,
        decisionComment: input.comment?.trim() || null,
        decidedBy: userId,
        decidedAt: new Date(),
      })
      .where(eq(reviewRequests.id, request.id))
    await tx
      .update(lessons)
      .set({ reviewStatus: transition.lessonStatus })
      .where(eq(lessons.id, lesson.id))
  })

  await createNotifications([request.requestedBy], {
    type: 'review',
    title:
      input.decision === 'approve'
        ? `Approved: ${lesson.title}`
        : input.decision === 'request_changes'
          ? `Changes requested: ${lesson.title}`
          : `Rejected: ${lesson.title}`,
    body: input.comment?.trim() || null,
    linkEntityType: 'course',
    linkEntityPublicId: (await resolveCourseById(request.courseId)).publicId,
  })
  return { ok: true }
}

export async function setApprovalGateImpl(input: {
  coursePublicId: string
  requiresApproval: boolean
}): Promise<{ ok: true }> {
  await requireRoleIn(['admin'])
  const course = await resolveCourse(input.coursePublicId)
  await db
    .update(courses)
    .set({ requiresApproval: input.requiresApproval })
    .where(eq(courses.id, course.id))
  return { ok: true }
}

/**
 * S-A.1 Review badge: pending review work across curriculum items **and** whole
 * courses.
 *
 * Two numbers, because the sidebar shows two badges and they answer different
 * questions:
 *
 * - `total` — every open submission in the workspace. This is the **Courses**
 *   badge: the review work that exists.
 * - `assignedToMe` — the open submissions the signed-in user can actually
 *   decide, i.e. the ones they did **not** author (spec 11 self-approval guard:
 *   "a user can never approve a submission they authored"). This is the
 *   **Review** badge, and it is what makes "2 of 5 assigned to you" a real,
 *   checkable number rather than a placeholder.
 *
 * Archived courses are **excluded** (their submissions are decisions already
 * taken), and the count is only produced for a role that can decide a
 * submission at all.
 */
export async function getPendingReviewCountImpl(): Promise<PendingReviewCounts> {
  const request = await import('@tanstack/react-start/server').then((mod) => mod.getRequest())
  const { getAuth } = await import('#/config/auth.server')
  const session = await getAuth().getSession(request.headers)
  if (!session.ok) return { total: 0, assignedToMe: 0 }

  const { resolvePlatformRoleImpl } = await import('#/features/auth/server/auth.roles.impl.server')
  const role = await resolvePlatformRoleImpl(session.value.user.id)
  if (!REVIEW_DECISION_ROLES.includes(role)) return { total: 0, assignedToMe: 0 }

  // Scoped to the active workspace: the badge counts this workspace's review
  // work and nothing else. A caller with no workspace has nothing to count, so
  // this is the one read that degrades to zero instead of throwing — the badge
  // must not take the whole navigation shell down with it.
  let organizationId: string
  try {
    organizationId = await requireActiveOrganizationId()
  } catch {
    return { total: 0, assignedToMe: 0 }
  }

  const rows = await db
    .select({ requestedBy: reviewRequests.requestedBy })
    .from(reviewRequests)
    .innerJoin(courses, eq(courses.id, reviewRequests.courseId))
    .where(
      and(
        eq(reviewRequests.state, 'pending'),
        eq(courses.organizationId, organizationId),
        isNull(courses.deletedAt),
        sql`${courses.status} <> 'archived'`,
      ),
    )

  const userId = session.value.user.id
  return {
    total: rows.length,
    assignedToMe: rows.filter((row) => row.requestedBy !== userId).length,
  }
}

async function resolveCourseById(courseId: number) {
  const rows = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, courseId), isNull(courses.deletedAt)))
    .limit(1)
  const course = rows.at(0)
  if (!course) throw new Error('COURSE_NOT_FOUND')
  return course
}
