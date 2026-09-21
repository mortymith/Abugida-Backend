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
  resolveCourse,
  resolveLesson,
  userIdsWithPlatformRoles,
} from './courses.server-helpers.server'
import { REVIEW_DECISION_ROLES } from '#/features/auth/auth.roles'
import { applyReviewDecision } from '../courses.review-state'
import type { ReviewDecisionInput, ReviewQueueQuery } from '../schemas/courses.workflow.schema'
import type { ReviewLessonPreview, ReviewQueueItem } from '../courses.types'

const requester = users

export async function getReviewQueueImpl(data: ReviewQueueQuery): Promise<ReviewQueueItem[]> {
  await requireRoleIn(['admin', 'reviewer'])

  const filters = [eq(reviewRequests.state, data.state)]
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
      linkEntityType: 'lesson',
      linkEntityPublicId: lesson.publicId,
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
    linkEntityType: 'lesson',
    linkEntityPublicId: lesson.publicId,
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

export async function getPendingReviewCountImpl(): Promise<number> {
  const request = await import('@tanstack/react-start/server').then((mod) => mod.getRequest())
  const { auth } = await import('#/config/auth.server')
  const session = await auth.getSession(request.headers)
  if (!session.ok) return 0

  const { resolvePlatformRoleImpl } = await import('#/features/auth/server/auth.roles.impl.server')
  const role = await resolvePlatformRoleImpl(session.value.user.id)
  if (!REVIEW_DECISION_ROLES.includes(role)) return 0

  const rows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(reviewRequests)
    .where(eq(reviewRequests.state, 'pending'))
  return Number(rows.at(0)?.count ?? 0)
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
