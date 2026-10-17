/**
 * @module bookmarks.repository
 *
 * Database operations for the bookmarks feature module.
 */

import { eq, and, desc, lt, isNull } from 'drizzle-orm'
import type { DatabaseClient } from '@abugida/database/client'
import { users } from '@abugida/database/auth'
import { bookmarks } from '@abugida/database/learning'
import { courses, lessons } from '@abugida/database/catalog'

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
  /**
   * Resolve an external public UUID to the internal numeric id stored on the
   * `bookmarks.item_id` column. Returns `undefined` when the referenced row
   * does not exist (or has been soft-deleted).
   */
  resolveItemIdByPublicId(itemType: string, publicId: string): Promise<number | undefined>
  /** Look up the public UUID of a course from its internal id. */
  findCoursePublicIdById(id: number): Promise<string | undefined>
  /** Look up the public UUID of a lesson from its internal id. */
  findLessonPublicIdById(id: number): Promise<string | undefined>
  getBookmarks(
    userId: string,
    opts: { cursor: string | undefined; limit: number },
  ): Promise<{ rows: BookmarkWithCourse[]; hasMore: boolean }>
  createBookmark(userId: string, itemType: string, itemId: number): Promise<BookmarkRow>
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

    async resolveItemIdByPublicId(itemType, publicId) {
      if (itemType === 'course') {
        const [row] = await db
          .select({ id: courses.id })
          .from(courses)
          .where(and(eq(courses.publicId, publicId), isNull(courses.deletedAt)))
          .limit(1)
        return row?.id
      }
      // `itemType === 'resource'` (or the legacy `'lesson'` spelling) resolves
      // to a lesson row. The bookmarks schema only allows `'course' | 'resource'`
      // at the API boundary, but we accept `'lesson'` defensively in case a
      // legacy client or migration sends it.
      const [row] = await db
        .select({ id: lessons.id })
        .from(lessons)
        .where(
          and(
            eq(lessons.publicId, publicId),
            isNull(lessons.deletedAt),
            eq(lessons.visibility, 'published'),
            isNull(lessons.archivedAt),
          ),
        )
        .limit(1)
      return row?.id
    },

    async findCoursePublicIdById(id) {
      const [row] = await db
        .select({ publicId: courses.publicId })
        .from(courses)
        .where(eq(courses.id, id))
        .limit(1)
      return row?.publicId
    },

    async findLessonPublicIdById(id) {
      const [row] = await db
        .select({ publicId: lessons.publicId })
        .from(lessons)
        .where(eq(lessons.id, id))
        .limit(1)
      return row?.publicId
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
      const [bookmark] = await db
        .insert(bookmarks)
        .values({
          userId,
          itemType: itemType as 'course' | 'resource',
          itemId,
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
