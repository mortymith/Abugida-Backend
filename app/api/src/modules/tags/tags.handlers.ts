/**
 * @module tags.handlers
 *
 * Route handler implementations for the tags feature module.
 */

import type { Context } from 'hono'
import type { TagsService } from './tags.service'
import type { AppEnv } from '@/middleware/types'

// ── Handlers ───────────────────────────────────────────────────────────────

export function createTagsHandlers(service: TagsService) {
  return {
    async listTags(c: Context<AppEnv>) {
      const result = await service.listTags()
      return c.json(result)
    },

    async listCoursesByTag(c: Context<AppEnv>) {
      const tagId = c.req.param('tagId') as string
      const query = c.req.query()
      const result = await service.listCoursesByTag(tagId, {
        cursor: query.cursor,
        limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
      })
      return c.json(result)
    },
  }
}

// ── Route-to-handler mapping ───────────────────────────────────────────────

import { listTagsRoute, listCoursesByTagRoute } from './tags.routes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (c: any) => Promise<any>

export function createTagsRouteMap(handlers: ReturnType<typeof createTagsHandlers>) {
  return [
    { route: listTagsRoute, handler: handlers.listTags as AnyHandler },
    { route: listCoursesByTagRoute, handler: handlers.listCoursesByTag as AnyHandler },
  ] as const
}
