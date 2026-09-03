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

      const data = rows.map((row) => ({
        id: row.publicId,
        itemType: row.itemType,
        itemId: String(row.itemId),
        createdAt: row.createdAt.toISOString(),
      }))

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

      const existing = await repo.findBookmarkByItemId(
        userId,
        fields.itemType,
        Number.parseInt(fields.itemId, 10),
      )
      if (existing) throw new ConflictError('Item is already bookmarked.')

      const bookmark = await repo.createBookmark(userId, fields.itemType, fields.itemId)
      return {
        id: bookmark.publicId,
        itemType: bookmark.itemType,
        itemId: String(bookmark.itemId),
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
