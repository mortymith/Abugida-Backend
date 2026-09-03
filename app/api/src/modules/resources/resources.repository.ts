/**
 * @module resources.repository
 *
 * Database operations for the resources feature module.
 */

import { eq, and, desc, asc, lt, isNull, sql } from 'drizzle-orm'
import type { DatabaseClient } from '@abugida/database/client'
import { courses } from '@abugida/database/catalog'
import { courseStats } from '@abugida/database/catalog'
import { modules } from '@abugida/database/catalog'
import { lessons } from '@abugida/database/catalog'

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

export interface CourseRow {
  id: number
  publicId: string
  examTypeId: number
  title: string
  slug: string
  description: string | null
  thumbnailObjectKey: string | null
  priceAmount: string | null
  priceCurrency: string
  isFree: boolean
  status: string | null
  publishedAt: Date | null
  version: number
  rowVersion: number
}

export interface CourseStatsRow {
  averageRating: string | null
  ratingCount: number
  totalEnrollments: number
}

export interface CourseWithStats extends CourseRow {
  averageRating: string | null
  ratingCount: number
  totalEnrollments: number
}

export interface ModuleRow {
  id: number
  publicId: string
  courseId: number
  title: string
  description: string | null
  sortOrder: number
  estimatedDurationMinutes: number | null
  isPreviewAvailable: boolean
}

export interface ModuleWithCount extends ModuleRow {
  lessonCount: number
}

export interface LessonRow {
  id: number
  publicId: string
  moduleId: number
  courseId: number
  title: string
  description: string | null
  contentType: string | null
  fileSizeBytes: number | null
  mimeType: string | null
  durationSeconds: number | null
  pageCount: number | null
  isDownloadable: boolean
  rowVersion: number
}

// ── Repository interface ───────────────────────────────────────────────────

export interface ResourcesRepository {
  findExamTypeIdByPublicId(publicId: string): Promise<number | undefined>
  findCourseByPublicId(publicId: string): Promise<CourseWithStats | undefined>
  findCoursesByExamType(
    examTypeId: number,
    opts: { cursor: string | undefined; limit: number; sort: string | undefined },
  ): Promise<{ rows: CourseWithStats[]; hasMore: boolean }>
  findModulesByCourse(courseId: number): Promise<ModuleWithCount[]>
  findLessonsByModule(
    moduleId: number,
    opts: { cursor: string | undefined; limit: number },
  ): Promise<{ rows: LessonRow[]; hasMore: boolean }>
  findLessonByPublicId(publicId: string): Promise<LessonRow | undefined>
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createResourcesRepository(db: DatabaseClient): ResourcesRepository {
  return {
    async findExamTypeIdByPublicId(publicId) {
      const [row] = await db
        .select({ id: sql<number>`exam_types.id` })
        .from(sql`exam_types`)
        .where(sql`exam_types.public_id = ${publicId}`)
        .limit(1)
      return row?.id
    },

    async findCourseByPublicId(publicId) {
      const [row] = await db
        .select({
          id: courses.id,
          publicId: courses.publicId,
          examTypeId: courses.examTypeId,
          title: courses.title,
          slug: courses.slug,
          description: courses.description,
          thumbnailObjectKey: courses.thumbnailObjectKey,
          priceAmount: courses.priceAmount,
          priceCurrency: courses.priceCurrency,
          isFree: courses.isFree,
          status: courses.status,
          publishedAt: courses.publishedAt,
          version: courses.version,
          rowVersion: courses.rowVersion,
          averageRating: courseStats.averageRating,
          ratingCount: courseStats.ratingCount,
          totalEnrollments: courseStats.totalEnrollments,
        })
        .from(courses)
        .leftJoin(courseStats, eq(courses.id, courseStats.courseId))
        .where(and(eq(courses.publicId, publicId), isNull(courses.deletedAt)))
        .limit(1)
      return row as CourseWithStats | undefined
    },

    async findCoursesByExamType(examTypeId, opts) {
      const { cursor, limit, sort } = opts
      const effectiveLimit = limit + 1

      const conditions = [
        eq(courses.examTypeId, examTypeId),
        isNull(courses.deletedAt),
        eq(courses.status, 'published'),
      ]

      const cursorId = decodeCursor(cursor)
      if (cursorId !== undefined) {
        conditions.push(lt(courses.id, cursorId))
      }

      let orderClause
      switch (sort) {
        case 'rating':
          orderClause = desc(courseStats.averageRating)
          break
        case 'popularity':
          orderClause = desc(courseStats.popularityScore)
          break
        case 'newest':
          orderClause = desc(courses.publishedAt)
          break
        case 'price_low':
          orderClause = asc(courses.priceAmount)
          break
        case 'price_high':
          orderClause = desc(courses.priceAmount)
          break
        default:
          orderClause = asc(courses.sortOrder)
      }

      const rows = await db
        .select({
          id: courses.id,
          publicId: courses.publicId,
          examTypeId: courses.examTypeId,
          title: courses.title,
          slug: courses.slug,
          description: courses.description,
          thumbnailObjectKey: courses.thumbnailObjectKey,
          priceAmount: courses.priceAmount,
          priceCurrency: courses.priceCurrency,
          isFree: courses.isFree,
          status: courses.status,
          publishedAt: courses.publishedAt,
          version: courses.version,
          rowVersion: courses.rowVersion,
          averageRating: courseStats.averageRating,
          ratingCount: courseStats.ratingCount,
          totalEnrollments: courseStats.totalEnrollments,
        })
        .from(courses)
        .leftJoin(courseStats, eq(courses.id, courseStats.courseId))
        .where(and(...conditions))
        .orderBy(orderClause, desc(courses.id))
        .limit(effectiveLimit)

      const hasMore = rows.length > limit
      const data = hasMore ? rows.slice(0, limit) : rows

      return { rows: data as CourseWithStats[], hasMore }
    },

    async findModulesByCourse(courseId) {
      const rows = await db
        .select({
          id: modules.id,
          publicId: modules.publicId,
          courseId: modules.courseId,
          title: modules.title,
          description: modules.description,
          sortOrder: modules.sortOrder,
          estimatedDurationMinutes: modules.estimatedDurationMinutes,
          isPreviewAvailable: modules.isPreviewAvailable,
          lessonCount: sql<number>`count(${lessons.id})::int`,
        })
        .from(modules)
        .leftJoin(lessons, and(eq(modules.id, lessons.moduleId), isNull(lessons.deletedAt)))
        .where(and(eq(modules.courseId, courseId), isNull(modules.deletedAt)))
        .groupBy(modules.id)
        .orderBy(asc(modules.sortOrder))

      return rows as ModuleWithCount[]
    },

    async findLessonsByModule(moduleId, opts) {
      const { cursor, limit } = opts
      const effectiveLimit = limit + 1

      const conditions = [eq(lessons.moduleId, moduleId), isNull(lessons.deletedAt)]

      const cursorId = decodeCursor(cursor)
      if (cursorId !== undefined) {
        conditions.push(lt(lessons.id, cursorId))
      }

      const rows = await db
        .select()
        .from(lessons)
        .where(and(...conditions))
        .orderBy(asc(lessons.id))
        .limit(effectiveLimit)

      const hasMore = rows.length > limit
      const data = hasMore ? rows.slice(0, limit) : rows

      return { rows: data as LessonRow[], hasMore }
    },

    async findLessonByPublicId(publicId) {
      const [row] = await db
        .select()
        .from(lessons)
        .where(and(eq(lessons.publicId, publicId), isNull(lessons.deletedAt)))
        .limit(1)
      return row as LessonRow | undefined
    },
  }
}

export { encodeCursor, decodeCursor }
