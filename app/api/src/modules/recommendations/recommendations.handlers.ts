/**
 * @module recommendations.handlers
 *
 * Route handler implementations for the recommendations feature module.
 */

import type { Context } from 'hono'
import type { RecommendationsService } from './recommendations.service'
import type { AppEnv } from '@/middleware/types'
import { problemResponse } from '@/middleware'

// ── Handlers ───────────────────────────────────────────────────────────────

export function createRecommendationsHandlers(service: RecommendationsService) {
  return {
    async listRecommendations(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return problemResponse(c, { status: 401, detail: 'Authentication required.' })

      const query = c.req.query()
      const result = await service.listRecommendations({
        limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
      })
      return c.json(result)
    },

    async getCourseRating(c: Context<AppEnv>) {
      const courseId = c.req.param('courseId') as string
      const result = await service.getCourseRating(courseId)
      if (!result) return problemResponse(c, { status: 404, detail: 'Course not found.' })
      return c.json({ data: result })
    },

    async submitRating(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return problemResponse(c, { status: 401, detail: 'Authentication required.' })

      const courseId = c.req.param('courseId') as string
      const body = await c.req.json()
      const result = await service.submitRating(courseId, user.id, {
        rating: body.rating,
      })
      if (!result.enrolled)
        return problemResponse(c, {
          status: 409,
          detail: 'You must be enrolled in this course to rate it.',
        })
      return c.body(null, 204)
    },

    async listReviews(c: Context<AppEnv>) {
      const courseId = c.req.param('courseId') as string
      const query = c.req.query()
      const result = await service.listReviews(courseId, {
        cursor: query.cursor,
        limit: query.limit ? Number.parseInt(query.limit, 10) : 20,
      })
      return c.json(result)
    },

    async submitReview(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return problemResponse(c, { status: 401, detail: 'Authentication required.' })

      const courseId = c.req.param('courseId') as string
      const body = await c.req.json()

      if (typeof body.rating !== 'number' || body.rating < 1 || body.rating > 5) {
        return problemResponse(c, {
          status: 422,
          detail: 'Rating must be an integer between 1 and 5.',
        })
      }
      if (typeof body.title !== 'string' || body.title.length < 1 || body.title.length > 200) {
        return problemResponse(c, {
          status: 422,
          detail: 'Title must be between 1 and 200 characters.',
        })
      }
      if (
        typeof body.content !== 'string' ||
        body.content.length < 10 ||
        body.content.length > 2000
      ) {
        return problemResponse(c, {
          status: 422,
          detail: 'Content must be between 10 and 2000 characters.',
        })
      }

      const result = await service.submitReview(courseId, user.id, {
        rating: body.rating,
        title: body.title,
        content: body.content,
      })

      if (!result.created)
        return problemResponse(c, {
          status: 409,
          detail: 'You have already reviewed this course.',
        })
      return c.json({ data: {} }, 201)
    },
  }
}

// ── Route-to-handler mapping ───────────────────────────────────────────────

import {
  listRecommendationsRoute,
  getCourseRatingRoute,
  submitRatingRoute,
  listReviewsRoute,
  submitReviewRoute,
} from './recommendations.routes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (c: any) => Promise<any>

export function createRecommendationsRouteMap(
  handlers: ReturnType<typeof createRecommendationsHandlers>,
) {
  return [
    { route: listRecommendationsRoute, handler: handlers.listRecommendations as AnyHandler },
    { route: getCourseRatingRoute, handler: handlers.getCourseRating as AnyHandler },
    { route: submitRatingRoute, handler: handlers.submitRating as AnyHandler },
    { route: listReviewsRoute, handler: handlers.listReviews as AnyHandler },
    { route: submitReviewRoute, handler: handlers.submitReview as AnyHandler },
  ] as const
}
