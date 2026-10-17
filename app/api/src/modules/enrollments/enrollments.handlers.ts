/**
 * @module enrollments.handlers
 *
 * Route handler implementations for the enrollments feature module. Handlers
 * extract the authenticated principal, delegate to the service layer, and
 * return typed responses.
 */

import type { Context } from 'hono'
import type { EnrollmentsService } from './enrollments.service'
import { EnrollmentNotFoundError, LessonNotFoundError } from './enrollments.service'
import type { AppEnv } from '@/middleware/types'
import { problemResponse } from '@/middleware'

// ── Handlers ───────────────────────────────────────────────────────────────

export function createEnrollmentsHandlers(service: EnrollmentsService) {
  return {
    async getProgress(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return problemResponse(c, { status: 401, detail: 'Authentication required.' })

      try {
        const stats = await service.getProgressStats(user.id)
        return c.json({ data: stats })
      } catch (error) {
        if (error instanceof EnrollmentNotFoundError)
          return problemResponse(c, { status: 404, detail: error.message })
        throw error
      }
    },

    async listEnrollments(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return problemResponse(c, { status: 401, detail: 'Authentication required.' })

      const query = c.req.query()
      try {
        const result = await service.listEnrollments(user.id, {
          cursor: query.cursor,
          limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
          status: query.status,
          source: query.source,
        })
        return c.json(result)
      } catch (error) {
        if (error instanceof EnrollmentNotFoundError)
          return problemResponse(c, { status: 404, detail: error.message })
        throw error
      }
    },

    async getEnrollment(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return problemResponse(c, { status: 401, detail: 'Authentication required.' })

      const enrollmentId = c.req.param('enrollmentId')
      if (!enrollmentId)
        return problemResponse(c, { status: 404, detail: 'Enrollment ID is required.' })

      try {
        const enrollment = await service.getEnrollment(user.id, enrollmentId)
        return c.json({ data: enrollment })
      } catch (error) {
        if (error instanceof EnrollmentNotFoundError)
          return problemResponse(c, { status: 404, detail: error.message })
        throw error
      }
    },

    async listLessonCompletions(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return problemResponse(c, { status: 401, detail: 'Authentication required.' })

      const enrollmentId = c.req.param('enrollmentId')
      if (!enrollmentId)
        return problemResponse(c, { status: 404, detail: 'Enrollment ID is required.' })

      const query = c.req.query()
      try {
        const result = await service.listLessonCompletions(user.id, enrollmentId, {
          cursor: query.cursor,
          limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
        })
        return c.json(result)
      } catch (error) {
        if (error instanceof EnrollmentNotFoundError)
          return problemResponse(c, { status: 404, detail: error.message })
        throw error
      }
    },

    async updateLessonCompletion(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return problemResponse(c, { status: 401, detail: 'Authentication required.' })

      const enrollmentId = c.req.param('enrollmentId')
      const lessonId = c.req.param('lessonId')
      if (!enrollmentId || !lessonId)
        return problemResponse(c, {
          status: 404,
          detail: 'Enrollment and lesson IDs are required.',
        })

      const body = await c.req.json()
      try {
        const result = await service.toggleLessonCompletion(user.id, enrollmentId, lessonId, {
          isCompleted: body.isCompleted,
          timeSpentSeconds: body.timeSpentSeconds,
        })
        return c.json({ data: result })
      } catch (error) {
        if (error instanceof EnrollmentNotFoundError)
          return problemResponse(c, { status: 404, detail: error.message })
        if (error instanceof LessonNotFoundError)
          return problemResponse(c, { status: 404, detail: error.message })
        throw error
      }
    },
  }
}

// ── Route-to-handler mapping ───────────────────────────────────────────────

import {
  getProgressRoute,
  listEnrollmentsRoute,
  getEnrollmentRoute,
  listLessonCompletionsRoute,
  updateLessonCompletionRoute,
} from './enrollments.routes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (c: any) => Promise<any>

export function createEnrollmentsRouteMap(handlers: ReturnType<typeof createEnrollmentsHandlers>) {
  return [
    { route: getProgressRoute, handler: handlers.getProgress as AnyHandler },
    { route: listEnrollmentsRoute, handler: handlers.listEnrollments as AnyHandler },
    { route: getEnrollmentRoute, handler: handlers.getEnrollment as AnyHandler },
    { route: listLessonCompletionsRoute, handler: handlers.listLessonCompletions as AnyHandler },
    { route: updateLessonCompletionRoute, handler: handlers.updateLessonCompletion as AnyHandler },
  ] as const
}
