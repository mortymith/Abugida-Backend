/**
 * @module recommendations.routes
 *
 * OpenAPI route definitions for the recommendations feature module.
 */

import { createRoute } from '@hono/zod-openapi'
import {
  UnauthorizedSchema,
  NotFoundSchema,
  ConflictSchema,
  UnprocessableEntitySchema,
  TooManyRequestsSchema,
  RecommendationListQuerySchema,
  ListRecommendationsResponseSchema,
  GetRatingParamsSchema,
  GetRatingResponseSchema,
  RatingSubmitSchema,
  PostRatingParamsSchema,
  ReviewListQuerySchema,
  GetReviewsParamsSchema,
  ListReviewsResponseSchema,
  ReviewSubmitSchema,
  PostReviewParamsSchema,
  PostReviewResponseSchema,
} from './recommendations.schemas'

// ── GET /users/me/recommendations ──────────────────────────────────────────

export const listRecommendationsRoute = createRoute({
  method: 'get',
  path: '/users/me/recommendations',
  tags: ['Recommendations'],
  summary: 'Get personalized recommendations',
  description:
    'Returns popularity-based course recommendations (FR-705). Uses catalog.course_stats index idx_course_stats_recommendation (popularity_score, weighted_rating).',
  operationId: 'getRecommendations',
  security: [{ Bearer: [] }],
  request: {
    query: RecommendationListQuerySchema,
  },
  responses: {
    200: {
      description: 'Recommended courses.',
      content: { 'application/json': { schema: ListRecommendationsResponseSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type ListRecommendationsRoute = typeof listRecommendationsRoute

// ── GET /courses/{courseId}/ratings ────────────────────────────────────────

export const getCourseRatingRoute = createRoute({
  method: 'get',
  path: '/courses/{courseId}/ratings',
  tags: ['Recommendations'],
  summary: 'Get course rating summary',
  description:
    "Maps to catalog.course_stats (average_rating, rating_count). The distribution field is computed at query time from learning.course_reviews WHERE course_id = :id AND moderation_status = 'approved' grouped by rating value.",
  operationId: 'getCourseRating',
  request: {
    params: GetRatingParamsSchema,
  },
  responses: {
    200: {
      description: 'Rating summary retrieved',
      content: { 'application/json': { schema: GetRatingResponseSchema } },
    },
    404: {
      description: 'Course not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type GetCourseRatingRoute = typeof getCourseRatingRoute

// ── POST /courses/{courseId}/ratings ───────────────────────────────────────

export const submitRatingRoute = createRoute({
  method: 'post',
  path: '/courses/{courseId}/ratings',
  tags: ['Recommendations'],
  summary: 'Submit rating for a course',
  description:
    'Submits or updates a rating. Requires enrollment. Updates catalog.course_stats.average_rating and rating_count.',
  operationId: 'submitRating',
  security: [{ Bearer: [] }],
  request: {
    params: PostRatingParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: RatingSubmitSchema } },
    },
  },
  responses: {
    204: {
      description: 'Rating submitted',
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    404: {
      description: 'Course not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    409: {
      description: 'Not enrolled in this course',
      content: { 'application/problem+json': { schema: ConflictSchema } },
    },
    422: {
      description: 'Invalid input',
      content: { 'application/problem+json': { schema: UnprocessableEntitySchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type SubmitRatingRoute = typeof submitRatingRoute

// ── GET /courses/{courseId}/reviews ────────────────────────────────────────

export const listReviewsRoute = createRoute({
  method: 'get',
  path: '/courses/{courseId}/reviews',
  tags: ['Recommendations'],
  summary: 'List approved reviews for a course',
  description:
    "Returns approved reviews only. Maps to learning.course_reviews WHERE course_id = :id AND moderation_status = 'approved'. Uses index idx_course_reviews_status_time.",
  operationId: 'listReviews',
  request: {
    params: GetReviewsParamsSchema,
    query: ReviewListQuerySchema,
  },
  responses: {
    200: {
      description: 'Reviews retrieved',
      content: { 'application/json': { schema: ListReviewsResponseSchema } },
    },
    404: {
      description: 'Course not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type ListReviewsRoute = typeof listReviewsRoute

// ── POST /courses/{courseId}/reviews ───────────────────────────────────────

export const submitReviewRoute = createRoute({
  method: 'post',
  path: '/courses/{courseId}/reviews',
  tags: ['Recommendations'],
  summary: 'Submit review for a course',
  description:
    'Submits a review (enters moderation queue with status=pending). Maps to learning.course_reviews. Unique constraint: one review per student per course.',
  operationId: 'submitReview',
  security: [{ Bearer: [] }],
  request: {
    params: PostReviewParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: ReviewSubmitSchema } },
    },
  },
  responses: {
    201: {
      description: 'Review submitted (pending moderation approval)',
      content: { 'application/json': { schema: PostReviewResponseSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    404: {
      description: 'Course not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    409: {
      description: 'Review already exists for this course',
      content: { 'application/problem+json': { schema: ConflictSchema } },
    },
    422: {
      description: 'Invalid input',
      content: { 'application/problem+json': { schema: UnprocessableEntitySchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type SubmitReviewRoute = typeof submitReviewRoute
