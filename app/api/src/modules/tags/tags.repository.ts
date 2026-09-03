/**
 * @module tags.repository
 *
 * Database operations for the tags feature module.
 */

import { eq, and, desc, lt, isNull } from 'drizzle-orm'
import type { DatabaseClient } from '@abugida/database/client'
import { courseTags } from '@abugida/database/catalog'
import { courseTagAssignments } from '@abugida/database/catalog'
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

export interface TagRow {
  id: number
  publicId: string
  name: string
  slug: string
  description: string | null
}

export interface CourseSummaryRow {
  courseId: number
  coursePublicId: string
  title: string
  slug: string
  description: string | null
  thumbnailObjectKey: string | null
  isFree: boolean
  status: string | null
}

// ── Repository interface ───────────────────────────────────────────────────

export interface TagsRepository {
  findAll(): Promise<TagRow[]>
  findCoursesByTag(
    tagPublicId: string,
    opts: { cursor: string | undefined; limit: number },
  ): Promise<{ rows: CourseSummaryRow[]; hasMore: boolean }>
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createTagsRepository(db: DatabaseClient): TagsRepository {
  return {
    async findAll() {
      return db
        .select()
        .from(courseTags)
        .where(and(isNull(courseTags.deletedAt)))
        .orderBy(courseTags.name)
    },

    async findCoursesByTag(tagPublicId, opts) {
      const { cursor, limit } = opts
      const effectiveLimit = limit + 1

      // First, find the tag by public ID
      const [tag] = await db
        .select({ id: courseTags.id })
        .from(courseTags)
        .where(and(eq(courseTags.publicId, tagPublicId), isNull(courseTags.deletedAt)))
        .limit(1)

      if (!tag) return { rows: [], hasMore: false }

      const conditions = [
        eq(courseTagAssignments.tagId, tag.id),
        isNull(courses.deletedAt),
        eq(courses.status, 'published'),
      ]

      const cursorId = decodeCursor(cursor)
      if (cursorId !== undefined) {
        conditions.push(lt(courseTagAssignments.id, cursorId))
      }

      const rows = await db
        .select({
          courseId: courses.id,
          coursePublicId: courses.publicId,
          title: courses.title,
          slug: courses.slug,
          description: courses.description,
          thumbnailObjectKey: courses.thumbnailObjectKey,
          isFree: courses.isFree,
          status: courses.status,
        })
        .from(courseTagAssignments)
        .innerJoin(courses, eq(courseTagAssignments.courseId, courses.id))
        .where(and(...conditions))
        .orderBy(desc(courseTagAssignments.id))
        .limit(effectiveLimit)

      const hasMore = rows.length > limit
      const data = hasMore ? rows.slice(0, limit) : rows

      return { rows: data, hasMore }
    },
  }
}

export { encodeCursor, decodeCursor }
