/**
 * @module resources.handlers
 *
 * Route handler implementations for the resources feature module.
 */

import type { Context } from 'hono'
import type { ResourcesService } from './resources.service'
import { NotFoundError } from './resources.service'
import type { AppEnv } from '@/middleware/types'

// ── Helpers ────────────────────────────────────────────────────────────────

function notFound(c: Context<AppEnv>, detail: string) {
  return c.json(
    {
      type: 'https://api.abugida.com/errors/not-found',
      title: 'Not Found',
      status: 404,
      detail,
      instance: c.req.path,
    } as const,
    404,
  )
}

// ── Handlers ───────────────────────────────────────────────────────────────

export function createResourcesHandlers(service: ResourcesService) {
  return {
    async listCoursesByExamType(c: Context<AppEnv>) {
      const examTypeId = c.req.param('examTypeId') as string
      const query = c.req.query()
      try {
        const result = await service.listCoursesByExamType(examTypeId, {
          cursor: query.cursor,
          limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
          sort: query.sort,
        })
        return c.json(result)
      } catch (error) {
        if (error instanceof NotFoundError) return notFound(c, error.message)
        throw error
      }
    },

    async getCourse(c: Context<AppEnv>) {
      const courseId = c.req.param('courseId') as string
      try {
        const course = await service.getCourse(courseId)
        const etag = `W/"${course.rowVersion}"`
        const ifNoneMatch = c.req.header('if-none-match')
        if (ifNoneMatch === etag) return c.body(null, 304)
        return c.json({ data: course }, 200, {
          ETag: etag,
          'Cache-Control': 'private, max-age=300',
        })
      } catch (error) {
        if (error instanceof NotFoundError) return notFound(c, error.message)
        throw error
      }
    },

    async getCourseCurriculum(c: Context<AppEnv>) {
      const courseId = c.req.param('courseId') as string
      try {
        const curriculum = await service.getCourseCurriculum(courseId)
        return c.json({ data: curriculum })
      } catch (error) {
        if (error instanceof NotFoundError) return notFound(c, error.message)
        throw error
      }
    },

    async listModules(c: Context<AppEnv>) {
      const courseId = c.req.param('courseId') as string
      try {
        const result = await service.listModules(courseId)
        return c.json(result)
      } catch (error) {
        if (error instanceof NotFoundError) return notFound(c, error.message)
        throw error
      }
    },

    async listModuleLessons(c: Context<AppEnv>) {
      const moduleId = c.req.param('moduleId') as string
      const query = c.req.query()
      try {
        const result = await service.listModuleLessons(moduleId, {
          cursor: query.cursor,
          limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
        })
        return c.json(result)
      } catch (error) {
        if (error instanceof NotFoundError) return notFound(c, error.message)
        throw error
      }
    },

    async getResource(c: Context<AppEnv>) {
      const resourceId = c.req.param('resourceId') as string
      try {
        const resource = await service.getResource(resourceId)
        const etag = `W/"${resource.rowVersion}"`
        const ifNoneMatch = c.req.header('if-none-match')
        if (ifNoneMatch === etag) return c.body(null, 304)
        return c.json({ data: resource }, 200, {
          ETag: etag,
          'Cache-Control': 'private, max-age=300',
        })
      } catch (error) {
        if (error instanceof NotFoundError) return notFound(c, error.message)
        throw error
      }
    },
  }
}

// ── Route-to-handler mapping ───────────────────────────────────────────────

import {
  listCoursesByExamTypeRoute,
  getCourseRoute,
  getCourseCurriculumRoute,
  listModulesRoute,
  listModuleLessonsRoute,
  getResourceRoute,
} from './resources.routes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (c: any) => Promise<any>

export function createResourcesRouteMap(handlers: ReturnType<typeof createResourcesHandlers>) {
  return [
    {
      route: listCoursesByExamTypeRoute,
      handler: handlers.listCoursesByExamType as AnyHandler,
    },
    { route: getCourseRoute, handler: handlers.getCourse as AnyHandler },
    {
      route: getCourseCurriculumRoute,
      handler: handlers.getCourseCurriculum as AnyHandler,
    },
    { route: listModulesRoute, handler: handlers.listModules as AnyHandler },
    {
      route: listModuleLessonsRoute,
      handler: handlers.listModuleLessons as AnyHandler,
    },
    { route: getResourceRoute, handler: handlers.getResource as AnyHandler },
  ] as const
}
