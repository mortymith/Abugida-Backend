/**
 * @module bookmarks.service
 *
 * Business logic for the bookmarks feature module.
 */

import type { BookmarksRepository } from './bookmarks.repository'
import { encodeCursor } from './bookmarks.repository'
import type { BookmarkView, BookmarkCreateFields, BookmarkListQuery } from './bookmarks.types'

// ── Errors ─────────────────────────────────────────────────────────────────

export class BookmarkNotFoundError extends Error {
  constructor(message = 'Bookmark not found.') {
    super(message)
    this.name = 'BookmarkNotFoundError'
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

/**
 * Thrown when a bookmark request references an item that doesn't exist (or has
 * been soft-deleted). Distinct from `BookmarkNotFoundError` so the handler can
 * return 422 instead of 404 — the bookmark itself doesn't exist yet because the
 * referenced item doesn't.
 */
export class BookmarkItemNotFoundError extends Error {
  constructor(message = 'Referenced item not found.') {
    super(message)
    this.name = 'BookmarkItemNotFoundError'
  }
}

// ── Service ────────────────────────────────────────────────────────────────

export interface BookmarksService {
  listBookmarks(
    publicId: string,
    query: BookmarkListQuery,
  ): Promise<{
    data: BookmarkView[]
    meta: { cursor: string | null; hasMore: boolean; limit: number }
  }>
  createBookmark(publicId: string, fields: BookmarkCreateFields): Promise<BookmarkView>
  removeBookmark(publicId: string, itemId: string): Promise<void>
}

export function createBookmarksService(repo: BookmarksRepository): BookmarksService {
  return {
    async listBookmarks(publicId, query) {
      const userId = await repo.findUserIdByPublicId(publicId)
      if (!userId) throw new BookmarkNotFoundError('User not found.')

      const limit = query.limit ?? 20
      const { rows, hasMore } = await repo.getBookmarks(userId, {
        cursor: query.cursor,
        limit,
      })

      // Resolve the internal numeric `itemId` back to the public UUID the API
      // exposes. N+1 lookups are acceptable here because the typical bookmark
      // list is small (default limit 20) and avoids a wider join on every list.
      const data = await Promise.all(
        rows.map(async (row) => {
          const itemId =
            row.itemType === 'course'
              ? await repo.findCoursePublicIdById(row.itemId)
              : await repo.findLessonPublicIdById(row.itemId)
          return {
            id: row.publicId,
            itemType: row.itemType,
            itemId: itemId ?? '',
            createdAt: row.createdAt.toISOString(),
          }
        }),
      )

      const lastRow = rows[rows.length - 1]
      return {
        data,
        meta: {
          cursor: hasMore && lastRow ? encodeCursor(lastRow.id) : null,
          hasMore,
          limit,
        },
      }
    },

    async createBookmark(publicId, fields) {
      const userId = await repo.findUserIdByPublicId(publicId)
      if (!userId) throw new BookmarkNotFoundError('User not found.')

      // `itemId` arrives as a public UUID; the `bookmarks.item_id` column is a
      // bigint referencing `courses.id` or `lessons.id`. Resolve to the internal
      // id before checking for an existing bookmark / inserting.
      const internalItemId = await repo.resolveItemIdByPublicId(
        fields.itemType,
        fields.itemId,
      )
      if (internalItemId === undefined) throw new BookmarkItemNotFoundError()

      const existing = await repo.findBookmarkByItemId(
        userId,
        fields.itemType,
        internalItemId,
      )
      if (existing) throw new ConflictError('Item is already bookmarked.')

      const bookmark = await repo.createBookmark(userId, fields.itemType, internalItemId)
      const bookmarkItemId =
        bookmark.itemType === 'course'
          ? await repo.findCoursePublicIdById(bookmark.itemId)
          : await repo.findLessonPublicIdById(bookmark.itemId)
      return {
        id: bookmark.publicId,
        itemType: bookmark.itemType,
        itemId: bookmarkItemId ?? '',
        createdAt: bookmark.createdAt.toISOString(),
      }
    },

    async removeBookmark(publicId, itemId) {
      const userId = await repo.findUserIdByPublicId(publicId)
      if (!userId) throw new BookmarkNotFoundError('User not found.')

      const deleted = await repo.deleteBookmark(userId, itemId)
      if (!deleted) throw new BookmarkNotFoundError()
    },
  }
}
