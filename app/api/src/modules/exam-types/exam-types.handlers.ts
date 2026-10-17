/**
 * @module exam-types.handlers
 *
 * Route handler implementations for the exam types feature module.
 */

import type { Context } from 'hono'
import type { ExamTypesService } from './exam-types.service'
import { ExamTypeNotFoundError } from './exam-types.service'
import type { AppEnv } from '@/middleware/types'
import { problemResponse } from '@/middleware'

// ── Handlers ───────────────────────────────────────────────────────────────

export function createExamTypesHandlers(service: ExamTypesService) {
  return {
    async listExamTypes(c: Context<AppEnv>) {
      const query = c.req.query()
      const result = await service.listExamTypes({
        cursor: query.cursor,
        limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
        includeChildren: query.include_children === 'true',
      })
      return c.json(result, 200, { 'Cache-Control': 'public, max-age=3600' })
    },

    async getExamType(c: Context<AppEnv>) {
      const examTypeId = c.req.param('examTypeId') as string
      const query = c.req.query()
      try {
        const examType = await service.getExamType(examTypeId, query.include_children !== 'false')
        return c.json({ data: examType })
      } catch (error) {
        if (error instanceof ExamTypeNotFoundError)
          return problemResponse(c, { status: 404, detail: 'Exam type not found.' })
        throw error
      }
    },

    async listChildExamTypes(c: Context<AppEnv>) {
      const examTypeId = c.req.param('examTypeId') as string
      try {
        const result = await service.listChildExamTypes({
          parentExamTypeId: examTypeId,
        })
        return c.json(result)
      } catch (error) {
        if (error instanceof ExamTypeNotFoundError)
          return problemResponse(c, { status: 404, detail: 'Parent exam type not found.' })
        throw error
      }
    },
  }
}

// ── Route-to-handler mapping ───────────────────────────────────────────────

import { listExamTypesRoute, getExamTypeRoute, listChildExamTypesRoute } from './exam-types.routes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (c: any) => Promise<any>

export function createExamTypesRouteMap(handlers: ReturnType<typeof createExamTypesHandlers>) {
  return [
    { route: listExamTypesRoute, handler: handlers.listExamTypes as AnyHandler },
    { route: getExamTypeRoute, handler: handlers.getExamType as AnyHandler },
    { route: listChildExamTypesRoute, handler: handlers.listChildExamTypes as AnyHandler },
  ] as const
}
