/**
 * @module bookmarks.handlers
 *
 * Route handler implementations for the bookmarks feature module.
 */

import type { Context } from 'hono'
import type { BookmarksService } from './bookmarks.service'
import { BookmarkNotFoundError, ConflictError } from './bookmarks.service'
import type { AppEnv } from '@/middleware/types'

// ── Helpers ────────────────────────────────────────────────────────────────

function unauthorized(c: Context<AppEnv>, detail = 'Authentication required.') {
  return c.json(
    {
      type: 'https://api.abugida.com/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail,
      instance: c.req.path,
    } as const,
    401,
  )
}

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

function conflict(c: Context<AppEnv>, detail: string) {
  return c.json(
    {
      type: 'https://api.abugida.com/errors/conflict',
      title: 'Conflict',
      status: 409,
      detail,
      instance: c.req.path,
    } as const,
    409,
  )
}

// ── Handlers ───────────────────────────────────────────────────────────────

export function createBookmarksHandlers(service: BookmarksService) {
  return {
    async listBookmarks(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      const query = c.req.query()
      try {
        const result = await service.listBookmarks(user.id, {
          cursor: query.cursor,
          limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
        })
        return c.json(result)
      } catch (error) {
        if (error instanceof BookmarkNotFoundError) return notFound(c, error.message)
        throw error
      }
    },

    async createBookmark(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      const body = await c.req.json()
      try {
        const bookmark = await service.createBookmark(user.id, body)
        return c.json({ data: bookmark }, 201)
      } catch (error) {
        if (error instanceof BookmarkNotFoundError) return notFound(c, error.message)
        if (error instanceof ConflictError) return conflict(c, error.message)
        throw error
      }
    },

    async deleteBookmark(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      const itemId = c.req.param('itemId')
      if (!itemId) return notFound(c, 'Item ID is required.')

      try {
        await service.removeBookmark(user.id, itemId)
        return c.body(null, 204)
      } catch (error) {
        if (error instanceof BookmarkNotFoundError) return notFound(c, error.message)
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
