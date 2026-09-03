/**
 * @module bookmarks
 *
 * Bookmarks feature module — quick-access bookmark management for courses
 * and resources.
 *
 * Usage in app.ts:
 * ```ts
 * import { createBookmarksHandlers, createBookmarksRouteMap, createBookmarksRepository, createBookmarksService } from './modules/bookmarks'
 *
 * const bookmarksRepo = createBookmarksRepository(db)
 * const bookmarksService = createBookmarksService(bookmarksRepo)
 * const bookmarksHandlers = createBookmarksHandlers(bookmarksService)
 * for (const { route, handler } of createBookmarksRouteMap(bookmarksHandlers)) {
 *   app.openapi(route, handler)
 * }
 * ```
 */

export { listBookmarksRoute, createBookmarkRoute, deleteBookmarkRoute } from './bookmarks.routes'

export type {
  ListBookmarksRoute,
  CreateBookmarkRoute,
  DeleteBookmarkRoute,
} from './bookmarks.routes'

export { createBookmarksHandlers, createBookmarksRouteMap } from './bookmarks.handlers'

export { createBookmarksRepository, type BookmarksRepository } from './bookmarks.repository'

export {
  createBookmarksService,
  BookmarkNotFoundError,
  ConflictError,
  type BookmarksService,
} from './bookmarks.service'

export type { BookmarkView, BookmarkCreateFields, BookmarkListQuery } from './bookmarks.types'
