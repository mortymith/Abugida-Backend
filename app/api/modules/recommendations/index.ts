/**
 * @module recommendations
 *
 * Recommendations feature module — course ratings, reviews, and
 * personalized course recommendations based on popularity and rating signals.
 *
 * Usage in app.ts:
 * ```ts
 * import { createRecommendationsHandlers, createRecommendationsRouteMap, createRecommendationsRepository, createRecommendationsService } from '#/modules/recommendations'
 *
 * const recommendationsRepo = createRecommendationsRepository(db)
 * const recommendationsService = createRecommendationsService(recommendationsRepo)
 * const recommendationsHandlers = createRecommendationsHandlers(recommendationsService)
 * for (const { route, handler } of createRecommendationsRouteMap(recommendationsHandlers)) {
 *   app.openapi(route, handler)
 * }
 * ```
 */

export {
  listRecommendationsRoute,
  getCourseRatingRoute,
  submitRatingRoute,
  listReviewsRoute,
  submitReviewRoute,
} from '#/modules/recommendations/recommendations.routes'

export type {
  ListRecommendationsRoute,
  GetCourseRatingRoute,
  SubmitRatingRoute,
  ListReviewsRoute,
  SubmitReviewRoute,
} from '#/modules/recommendations/recommendations.routes'

export {
  createRecommendationsHandlers,
  createRecommendationsRouteMap,
} from '#/modules/recommendations/recommendations.handlers'

export {
  createRecommendationsRepository,
  type RecommendationsRepository,
} from '#/modules/recommendations/recommendations.repository'

export {
  createRecommendationsService,
  type RecommendationsService,
} from '#/modules/recommendations/recommendations.service'

export type {
  RecommendationView,
  RecommendationListQuery,
  CourseRatingSummaryView,
  RatingSubmitInput,
  ReviewView,
  ReviewSubmitInput,
  ReviewListQuery,
} from '#/modules/recommendations/recommendations.types'
