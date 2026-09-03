/**
 * @module bookmarks.repository
 *
 * Database operations for the bookmarks feature module.
 */

import { eq, and, desc, lt } from 'drizzle-orm'
import type { DatabaseClient } from '@abugida/database/client'
import { users } from '@abugida/database/auth'
import { bookmarks } from '@abugida/database/learning'
import { courses } from '@abugida/database/catalog'

// ── Cursor helpers ─────────────────────────────────────────────────────────

function encodeCursor(id: number): string {
  return Buffer.from(`cursor:${id}`).toString('base64url')
}

function decodeCursor(cursor: string | undefined): number | undefined {
  if (!cursor) return undefined
  const decoded = Buffer.from(cursor, 'base64url').toString('utf-8')
  const match = decoded.match(/^cursor:(\d+)$/)
  if (!match?.[1]) throw new Error('Invalid cursor format')
  return Number.parseInt(match[1], 10)
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface BookmarkRow {
  id: number
  publicId: string
  userId: string
  itemType: string
  itemId: number
  createdAt: Date
}

export interface BookmarkWithCourse extends BookmarkRow {
  courseTitle: string | null
  courseSlug: string | null
  thumbnailObjectKey: string | null
}

// ── Repository interface ───────────────────────────────────────────────────

export interface BookmarksRepository {
  findUserIdByPublicId(publicId: string): Promise<string | undefined>
  getBookmarks(
    userId: string,
    opts: { cursor: string | undefined; limit: number },
  ): Promise<{ rows: BookmarkWithCourse[]; hasMore: boolean }>
  createBookmark(userId: string, itemType: string, itemId: string): Promise<BookmarkRow>
  deleteBookmark(userId: string, itemPublicId: string): Promise<boolean>
  findBookmarkByItemId(
    userId: string,
    itemType: string,
    itemId: number,
  ): Promise<BookmarkRow | undefined>
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createBookmarksRepository(db: DatabaseClient): BookmarksRepository {
  return {
    async findUserIdByPublicId(publicId) {
      const [row] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, publicId))
        .limit(1)
      return row?.id
    },

    async getBookmarks(userId, opts) {
      const { cursor, limit } = opts
      const effectiveLimit = limit + 1

      const conditions = [eq(bookmarks.userId, userId)]

      const cursorId = decodeCursor(cursor)
      if (cursorId !== undefined) {
        conditions.push(lt(bookmarks.id, cursorId))
      }

      const rows = await db
        .select({
          id: bookmarks.id,
          publicId: bookmarks.publicId,
          userId: bookmarks.userId,
          itemType: bookmarks.itemType,
          itemId: bookmarks.itemId,
          createdAt: bookmarks.createdAt,
          courseTitle: courses.title,
          courseSlug: courses.slug,
          thumbnailObjectKey: courses.thumbnailObjectKey,
        })
        .from(bookmarks)
        .leftJoin(courses, eq(bookmarks.itemId, courses.id))
        .where(and(...conditions))
        .orderBy(desc(bookmarks.id))
        .limit(effectiveLimit)

      const hasMore = rows.length > limit
      const data = hasMore ? rows.slice(0, limit) : rows

      return { rows: data, hasMore }
    },

    async createBookmark(userId, itemType, itemId) {
      const itemIdNum = Number.parseInt(itemId, 10)
      const [bookmark] = await db
        .insert(bookmarks)
        .values({
          userId,
          itemType: itemType as 'course' | 'resource',
          itemId: itemIdNum,
        })
        .returning()
      return bookmark!
    },

    async deleteBookmark(userId, itemPublicId) {
      const [deleted] = await db
        .delete(bookmarks)
        .where(and(eq(bookmarks.userId, userId), eq(bookmarks.publicId, itemPublicId)))
        .returning()
      return !!deleted
    },

    async findBookmarkByItemId(userId, itemType, itemId) {
      const [bookmark] = await db
        .select()
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.userId, userId),
            eq(bookmarks.itemType, itemType as 'course' | 'resource'),
            eq(bookmarks.itemId, itemId),
          ),
        )
        .limit(1)
      return bookmark
    },
  }
}

export { encodeCursor, decodeCursor }
