/**
 * @module recommendations.schemas
 *
 * Zod schemas for the recommendations feature module.
 */

import { z } from '@hono/zod-openapi'

// ── Shared error schemas ───────────────────────────────────────────────────

export const ProblemDetailSchema = z
  .object({
    type: z.string().url(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    instance: z.string(),
    correlationId: z.string().uuid().optional(),
  })
  .openapi('ProblemDetail')

export const UnauthorizedSchema = ProblemDetailSchema.extend({
  status: z.literal(401),
}).openapi('Unauthorized')

export const NotFoundSchema = ProblemDetailSchema.extend({
  status: z.literal(404),
}).openapi('NotFound')

export const ConflictSchema = ProblemDetailSchema.extend({
  status: z.literal(409),
}).openapi('Conflict')

export const UnprocessableEntitySchema = ProblemDetailSchema.extend({
  status: z.literal(422),
}).openapi('UnprocessableEntity')

export const TooManyRequestsSchema = ProblemDetailSchema.extend({
  status: z.literal(429),
}).openapi('TooManyRequests')

// ── Response wrappers ──────────────────────────────────────────────────────

export function singleResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z
    .object({
      data: dataSchema,
    })
    .openapi('SingleResponse')
}

export function cursorPaginatedResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z
    .object({
      data: z.array(dataSchema),
      meta: z.object({
        cursor: z.string().nullable(),
        hasMore: z.boolean(),
        limit: z.number().int(),
      }),
    })
    .openapi('CursorPaginatedResponse')
}

// ── GET /users/me/recommendations ──────────────────────────────────────────

export const RecommendationSchema = z
  .object({
    courseId: z.string().uuid(),
    title: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    thumbnailUrl: z.string().nullable(),
    averageRating: z.string().nullable(),
    ratingCount: z.number().int(),
    enrollmentCount: z.number().int(),
    score: z.string().nullable(),
  })
  .openapi('Recommendation')

export const RecommendationListQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .optional()
    .describe('Number of recommendations'),
})

export const ListRecommendationsResponseSchema = singleResponseSchema(z.array(RecommendationSchema))

// ── GET /courses/{courseId}/ratings ────────────────────────────────────────

export const CourseRatingSummarySchema = z
  .object({
    courseId: z.string().uuid(),
    averageRating: z.number().min(1).max(5).nullable(),
    ratingCount: z.number().int(),
    distribution: z.object({
      '1': z.number().int(),
      '2': z.number().int(),
      '3': z.number().int(),
      '4': z.number().int(),
      '5': z.number().int(),
    }),
  })
  .openapi('CourseRatingSummary')

export const GetRatingParamsSchema = z.object({
  courseId: z.string().uuid(),
})

export const GetRatingResponseSchema = singleResponseSchema(CourseRatingSummarySchema)

// ── POST /courses/{courseId}/ratings ───────────────────────────────────────

export const RatingSubmitSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
  })
  .openapi('RatingSubmit')

export const PostRatingParamsSchema = z.object({
  courseId: z.string().uuid(),
})

// ── GET /courses/{courseId}/reviews ────────────────────────────────────────

export const ReviewSchema = z
  .object({
    reviewId: z.string().uuid(),
    courseId: z.string().uuid(),
    studentDisplayName: z.string(),
    rating: z.number().int(),
    title: z.string(),
    content: z.string(),
    createdAt: z.string().datetime(),
  })
  .openapi('Review')

export const ReviewListQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque cursor for pagination'),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional().describe('Page size'),
})

export const GetReviewsParamsSchema = z.object({
  courseId: z.string().uuid(),
})

export const ListReviewsResponseSchema = cursorPaginatedResponseSchema(ReviewSchema)

// ── POST /courses/{courseId}/reviews ───────────────────────────────────────

export const ReviewSubmitSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    title: z.string().min(1).max(200),
    content: z.string().min(10).max(2000),
  })
  .openapi('ReviewSubmit')

export const PostReviewParamsSchema = z.object({
  courseId: z.string().uuid(),
})

export const PostReviewResponseSchema = singleResponseSchema(z.object({}))
