/**
 * @module bookmarks.handlers
 *
 * Route handler implementations for the bookmarks feature module.
 */

import type { Context } from 'hono'
import type { BookmarksService } from './bookmarks.service'
import {
  BookmarkNotFoundError,
  ConflictError,
  BookmarkItemNotFoundError,
} from './bookmarks.service'
import type { AppEnv } from '@/middleware/types'
import { problemResponse } from '@/middleware'

// ── Handlers ───────────────────────────────────────────────────────────────

export function createBookmarksHandlers(service: BookmarksService) {
  return {
    async listBookmarks(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return problemResponse(c, { status: 401, detail: 'Authentication required.' })

      const query = c.req.query()
      try {
        const result = await service.listBookmarks(user.id, {
          cursor: query.cursor,
          limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
        })
        return c.json(result)
      } catch (error) {
        if (error instanceof BookmarkNotFoundError)
          return problemResponse(c, { status: 404, detail: error.message })
        throw error
      }
    },

    async createBookmark(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return problemResponse(c, { status: 401, detail: 'Authentication required.' })

      const body = await c.req.json()
      try {
        const bookmark = await service.createBookmark(user.id, body)
        return c.json({ data: bookmark }, 201)
      } catch (error) {
        if (error instanceof BookmarkNotFoundError)
          return problemResponse(c, { status: 404, detail: error.message })
        if (error instanceof BookmarkItemNotFoundError)
          return problemResponse(c, { status: 422, detail: error.message })
        if (error instanceof ConflictError)
          return problemResponse(c, { status: 409, detail: error.message })
        throw error
      }
    },

    async deleteBookmark(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return problemResponse(c, { status: 401, detail: 'Authentication required.' })

      const itemId = c.req.param('itemId')
      if (!itemId) return problemResponse(c, { status: 404, detail: 'Item ID is required.' })

      try {
        await service.removeBookmark(user.id, itemId)
        return c.body(null, 204)
      } catch (error) {
        if (error instanceof BookmarkNotFoundError)
          return problemResponse(c, { status: 404, detail: error.message })
        throw error
      }
    },
  }
}

// ── Route-to-handler mapping ───────────────────────────────────────────────

import { listBookmarksRoute, createBookmarkRoute, deleteBookmarkRoute } from './bookmarks.routes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (c: any) => Promise<any>

export function createBookmarksRouteMap(handlers: ReturnType<typeof createBookmarksHandlers>) {
  return [
    { route: listBookmarksRoute, handler: handlers.listBookmarks as AnyHandler },
    { route: createBookmarkRoute, handler: handlers.createBookmark as AnyHandler },
    { route: deleteBookmarkRoute, handler: handlers.deleteBookmark as AnyHandler },
  ] as const
}
