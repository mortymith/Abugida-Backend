/**
 * @module recommendations.handlers
 *
 * Route handler implementations for the recommendations feature module.
 */

import type { Context } from 'hono'
import type { RecommendationsService } from './recommendations.service'
import type { AppEnv } from '@/middleware/types'

// ── Helpers ────────────────────────────────────────────────────────────────

function problemDetail(c: Context<AppEnv>, status: number, title: string, detail: string) {
  return c.json(
    {
      type: `https://api.abugida.com/errors/${title.toLowerCase().replace(/\s+/g, '-')}`,
      title,
      status,
      detail,
      instance: c.req.path,
    } as const,
    status as never,
  )
}

function unauthorized(c: Context<AppEnv>, detail = 'Authentication required.') {
  return problemDetail(c, 401, 'Unauthorized', detail)
}

function notFound(c: Context<AppEnv>, detail = 'Course not found.') {
  return problemDetail(c, 404, 'Not Found', detail)
}

function conflict(c: Context<AppEnv>, detail: string) {
  return problemDetail(c, 409, 'Conflict', detail)
}

function unprocessableEntity(c: Context<AppEnv>, detail: string) {
  return problemDetail(c, 422, 'Unprocessable Entity', detail)
}

// ── Handlers ───────────────────────────────────────────────────────────────

export function createRecommendationsHandlers(service: RecommendationsService) {
  return {
    async listRecommendations(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      const query = c.req.query()
      const result = await service.listRecommendations({
        limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
      })
      return c.json(result)
    },

    async getCourseRating(c: Context<AppEnv>) {
      const courseId = c.req.param('courseId') as string
      const result = await service.getCourseRating(courseId)
      if (!result) return notFound(c)
      return c.json({ data: result })
    },

    async submitRating(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      const courseId = c.req.param('courseId') as string
      const body = await c.req.json()
      const result = await service.submitRating(courseId, user.id, {
        rating: body.rating,
      })
      if (!result.enrolled) return conflict(c, 'You must be enrolled in this course to rate it.')
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
      if (!user) return unauthorized(c)

      const courseId = c.req.param('courseId') as string
      const body = await c.req.json()

      if (typeof body.rating !== 'number' || body.rating < 1 || body.rating > 5) {
        return unprocessableEntity(c, 'Rating must be an integer between 1 and 5.')
      }
      if (typeof body.title !== 'string' || body.title.length < 1 || body.title.length > 200) {
        return unprocessableEntity(c, 'Title must be between 1 and 200 characters.')
      }
      if (
        typeof body.content !== 'string' ||
        body.content.length < 10 ||
        body.content.length > 2000
      ) {
        return unprocessableEntity(c, 'Content must be between 10 and 2000 characters.')
      }

      const result = await service.submitReview(courseId, user.id, {
        rating: body.rating,
        title: body.title,
        content: body.content,
      })

      if (!result.created) return conflict(c, 'You have already reviewed this course.')
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
