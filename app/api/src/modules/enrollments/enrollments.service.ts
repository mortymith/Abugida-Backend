/**
 * @module enrollments.service
 *
 * Business logic for the enrollments feature module. Handles progress
 * aggregation, enrollment queries, lesson completion toggling, and
 * progress recalculation.
 */

import type { QueueClient } from '@abugida/queue'
import { JobType } from '@abugida/queue'
import type { EnrollmentsRepository } from './enrollments.repository'
import { encodeCursor as encode } from './enrollments.repository'
import type {
  ProgressStats,
  EnrollmentView,
  EnrollmentDetailView,
  LessonCompletionView,
  LessonCompletionToggle,
  EnrollmentListQuery,
  LessonCompletionListQuery,
} from './enrollments.types'

// ── Errors ─────────────────────────────────────────────────────────────────

export class EnrollmentNotFoundError extends Error {
  constructor(message = 'Enrollment not found.') {
    super(message)
    this.name = 'EnrollmentNotFoundError'
  }
}

export class LessonNotFoundError extends Error {
  constructor(message = 'Lesson not found.') {
    super(message)
    this.name = 'LessonNotFoundError'
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

// ── Service ────────────────────────────────────────────────────────────────

export interface EnrollmentsService {
  getProgressStats(publicId: string): Promise<ProgressStats>
  listEnrollments(
    publicId: string,
    query: EnrollmentListQuery,
  ): Promise<{
    data: EnrollmentView[]
    meta: { cursor: string | null; hasMore: boolean; limit: number }
  }>
  getEnrollment(publicId: string, enrollmentPublicId: string): Promise<EnrollmentDetailView>
  listLessonCompletions(
    publicId: string,
    enrollmentPublicId: string,
    query: LessonCompletionListQuery,
  ): Promise<{
    data: LessonCompletionView[]
    meta: { cursor: string | null; hasMore: boolean; limit: number }
  }>
  toggleLessonCompletion(
    publicId: string,
    enrollmentPublicId: string,
    lessonPublicId: string,
    toggle: LessonCompletionToggle,
  ): Promise<LessonCompletionView>
}

export function createEnrollmentsService(
  repo: EnrollmentsRepository,
  queue?: QueueClient,
): EnrollmentsService {
  return {
    async getProgressStats(publicId) {
      const userId = await repo.findUserIdByPublicId(publicId)
      if (!userId) throw new EnrollmentNotFoundError('User not found.')

      const stats = await repo.getProgressStats(userId)
      return {
        totalEnrollments: stats.totalEnrollments,
        activeEnrollments: stats.activeEnrollments,
        completedEnrollments: stats.completedEnrollments,
        totalLessonsCompleted: stats.totalLessonsCompleted,
        totalStudyTimeSeconds: stats.totalStudyTimeSeconds,
      }
    },

    async listEnrollments(publicId, query) {
      const userId = await repo.findUserIdByPublicId(publicId)
      if (!userId) throw new EnrollmentNotFoundError('User not found.')

      const limit = query.limit ?? 20
      const { rows, hasMore } = await repo.getEnrollments(userId, {
        cursor: query.cursor,
        limit,
        status: query.status,
        source: query.source,
      })

      const data = rows.map((row) => ({
        id: row.publicId,
        courseId: row.coursePublicId,
        purchaseId: row.purchasePublicId,
        bundleId: row.bundlePublicId,
        enrollmentSource: row.enrollmentSource ?? 'purchase',
        progressPercentage: Number(row.progressPercentage),
        isCompleted: row.isCompleted,
        completedAt: row.completedAt?.toISOString() ?? null,
        lastAccessedAt: row.lastAccessedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      }))

      const lastRow = rows[rows.length - 1]
      return {
        data,
        meta: {
          cursor: hasMore && lastRow ? encode(lastRow.id) : null,
          hasMore,
          limit,
        },
      }
    },

    async getEnrollment(publicId, enrollmentPublicId) {
      const userId = await repo.findUserIdByPublicId(publicId)
      if (!userId) throw new EnrollmentNotFoundError('User not found.')

      const row = await repo.findEnrollmentByPublicId(userId, enrollmentPublicId)
      if (!row) throw new EnrollmentNotFoundError()

      return {
        id: row.publicId,
        courseId: row.coursePublicId,
        purchaseId: row.purchasePublicId,
        bundleId: row.bundlePublicId,
        enrollmentSource: row.enrollmentSource ?? 'purchase',
        progressPercentage: Number(row.progressPercentage),
        isCompleted: row.isCompleted,
        completedAt: row.completedAt?.toISOString() ?? null,
        lastAccessedAt: row.lastAccessedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        totalLessons: row.totalLessons,
        completedLessons: row.completedLessons,
        rowVersion: row.rowVersion,
      }
    },

    async listLessonCompletions(publicId, enrollmentPublicId, query) {
      const userId = await repo.findUserIdByPublicId(publicId)
      if (!userId) throw new EnrollmentNotFoundError('User not found.')

      const limit = query.limit ?? 20
      const { rows, hasMore } = await repo.getLessonCompletions(userId, enrollmentPublicId, {
        cursor: query.cursor,
        limit,
      })

      const data = rows.map((row) => ({
        id: row.publicId,
        lessonId: row.lessonPublicId,
        enrollmentId: row.enrollmentPublicId,
        isCompleted: row.isCompleted,
        completedAt: row.completedAt?.toISOString() ?? null,
        timeSpentSeconds: row.timeSpentSeconds,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }))

      const lastRow = rows[rows.length - 1]
      return {
        data,
        meta: {
          cursor: hasMore && lastRow ? encode(lastRow.id) : null,
          hasMore,
          limit,
        },
      }
    },

    async toggleLessonCompletion(publicId, enrollmentPublicId, lessonPublicId, toggle) {
      const userId = await repo.findUserIdByPublicId(publicId)
      if (!userId) throw new EnrollmentNotFoundError('User not found.')

      const result = await repo.toggleLessonCompletion(
        userId,
        enrollmentPublicId,
        lessonPublicId,
        toggle.isCompleted,
        toggle.timeSpentSeconds,
      )

      if (!result) throw new LessonNotFoundError()

      // Recalculate enrollment progress asynchronously
      const enrollment = await repo.findEnrollmentByPublicId(userId, enrollmentPublicId)
      if (enrollment && queue) {
        const completedCount = await repo.getCompletedLessonCount(enrollment.id)
        await repo.incrementRowVersion(enrollment.id)

        await queue.enqueue(JobType.ENROLLMENT_PROGRESS_UPDATE, {
          enrollmentId: enrollmentPublicId,
          lessonId: lessonPublicId,
          completedLessons: completedCount,
          totalLessons: enrollment.totalLessons,
          idempotencyKey: `progress-${enrollmentPublicId}-${lessonPublicId}-${Date.now()}`,
        })
      }

      return {
        id: result.publicId,
        lessonId: result.lessonPublicId,
        enrollmentId: result.enrollmentPublicId,
        isCompleted: result.isCompleted,
        completedAt: result.completedAt?.toISOString() ?? null,
        timeSpentSeconds: result.timeSpentSeconds,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      }
    },
  }
}
