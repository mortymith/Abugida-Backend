/**
 * @module recommendations.service
 *
 * Business logic for the recommendations feature module.
 */

import type { RecommendationsRepository } from './recommendations.repository'
import type {
  RecommendationView,
  RecommendationListQuery,
  CourseRatingSummaryView,
  RatingSubmitInput,
  ReviewView,
  ReviewSubmitInput,
  ReviewListQuery,
} from './recommendations.types'

// ── Service ────────────────────────────────────────────────────────────────

export interface RecommendationsService {
  listRecommendations(query: RecommendationListQuery): Promise<{
    data: RecommendationView[]
  }>
  getCourseRating(courseId: string): Promise<CourseRatingSummaryView | null>
  submitRating(
    courseId: string,
    userId: string,
    input: RatingSubmitInput,
  ): Promise<{ enrolled: boolean }>
  listReviews(
    courseId: string,
    query: ReviewListQuery,
  ): Promise<{
    data: ReviewView[]
    meta: { cursor: string | null; hasMore: boolean; limit: number }
  }>
  submitReview(
    courseId: string,
    userId: string,
    input: ReviewSubmitInput,
  ): Promise<{ created: boolean }>
}

export function createRecommendationsService(
  repo: RecommendationsRepository,
): RecommendationsService {
  return {
    async listRecommendations(query) {
      const limit = query.limit ?? 10
      const rows = await repo.findRecommendedCourses(limit)

      const data = rows.map((row) => ({
        courseId: String(row.courseId),
        title: row.title,
        slug: row.slug,
        description: row.description,
        thumbnailUrl: row.thumbnailObjectKey,
        averageRating: row.averageRating,
        ratingCount: row.ratingCount,
        enrollmentCount: row.totalEnrollments,
        score: row.score,
      }))

      return { data }
    },

    async getCourseRating(courseId) {
      const internalId = await repo.resolveCourseId(courseId)
      if (!internalId) return null

      const summary = await repo.findRatingSummary(internalId)
      if (!summary) return null

      return {
        courseId,
        averageRating: summary.averageRating ? Number.parseFloat(summary.averageRating) : null,
        ratingCount: summary.ratingCount,
        distribution: {
          '1': summary.distribution['1'] ?? 0,
          '2': summary.distribution['2'] ?? 0,
          '3': summary.distribution['3'] ?? 0,
          '4': summary.distribution['4'] ?? 0,
          '5': summary.distribution['5'] ?? 0,
        },
      }
    },

    async submitRating(courseId, userId, input) {
      const internalCourseId = await repo.resolveCourseId(courseId)
      if (!internalCourseId) return { enrolled: false }

      const enrolled = await repo.checkEnrollment(userId, internalCourseId)
      if (!enrolled) return { enrolled: false }

      await repo.upsertRating(userId, internalCourseId, input.rating)
      return { enrolled: true }
    },

    async listReviews(courseId, query) {
      const internalId = await repo.resolveCourseId(courseId)
      if (!internalId)
        return { data: [], meta: { cursor: null, hasMore: false, limit: query.limit } }

      const limit = query.limit ?? 20
      const { rows, hasMore } = await repo.findApprovedReviews(internalId, {
        cursor: query.cursor,
        limit,
      })

      const data = rows.map((row) => ({
        reviewId: row.reviewId,
        courseId: courseId,
        studentDisplayName: row.studentDisplayName ?? 'Anonymous',
        rating: row.rating,
        title: row.title,
        content: row.content,
        createdAt: row.createdAt.toISOString(),
      }))

      const lastRow = rows[rows.length - 1]
      const nextCursor = hasMore && lastRow ? encodeCursor(lastRow.id) : null

      return {
        data,
        meta: { cursor: nextCursor, hasMore, limit },
      }
    },

    async submitReview(courseId, userId, input) {
      const internalCourseId = await repo.resolveCourseId(courseId)
      if (!internalCourseId) return { created: false }

      const enrolled = await repo.checkEnrollment(userId, internalCourseId)
      if (!enrolled) return { created: false }

      const result = await repo.upsertReview(
        userId,
        internalCourseId,
        input.rating,
        input.title,
        input.content,
      )

      return { created: !result.isConflict }
    },
  }
}

function encodeCursor(id: number): string {
  return Buffer.from(`cursor:${id}`).toString('base64url')
}
