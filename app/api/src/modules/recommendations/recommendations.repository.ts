/**
 * @module recommendations.repository
 *
 * Database operations for the recommendations feature module.
 */

import { desc, eq, and, isNull, sql, lt, count } from 'drizzle-orm'
import type { DatabaseClient } from '@abugida/database/client'
import { courseStats } from '@abugida/database/catalog'
import { courses } from '@abugida/database/catalog'
import { courseReviews } from '@abugida/database/learning'
import { enrollments } from '@abugida/database/learning'
import { users } from '@abugida/database/auth'

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

export interface RecommendationRow {
  courseId: number
  title: string
  slug: string
  description: string | null
  thumbnailObjectKey: string | null
  averageRating: string | null
  ratingCount: number
  totalEnrollments: number
  score: string | null
}

export interface RatingSummaryRow {
  courseId: number
  averageRating: string | null
  ratingCount: number
  distribution: Record<string, number>
}

export interface ReviewRow {
  id: number
  reviewId: string
  courseId: number
  studentDisplayName: string | null
  rating: number
  title: string
  content: string
  createdAt: Date
}

// ── Repository interface ───────────────────────────────────────────────────

export interface RecommendationsRepository {
  findRecommendedCourses(limit: number): Promise<RecommendationRow[]>
  resolveCourseId(coursePublicId: string): Promise<number | null>
  findRatingSummary(courseId: number): Promise<RatingSummaryRow | null>
  checkEnrollment(studentId: string, courseId: number): Promise<boolean>
  upsertRating(studentId: string, courseId: number, rating: number): Promise<void>
  upsertReview(
    studentId: string,
    courseId: number,
    rating: number,
    title: string,
    content: string,
  ): Promise<{ isConflict: boolean }>
  findApprovedReviews(
    courseId: number,
    opts: { cursor: string | undefined; limit: number },
  ): Promise<{ rows: ReviewRow[]; hasMore: boolean }>
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createRecommendationsRepository(db: DatabaseClient): RecommendationsRepository {
  return {
    async findRecommendedCourses(limit) {
      const rows = await db
        .select({
          courseId: courses.id,
          title: courses.title,
          slug: courses.slug,
          description: courses.description,
          thumbnailObjectKey: courses.thumbnailObjectKey,
          averageRating: courseStats.averageRating,
          ratingCount: courseStats.ratingCount,
          totalEnrollments: courseStats.totalEnrollments,
          score: courseStats.popularityScore,
        })
        .from(courseStats)
        .innerJoin(courses, eq(courseStats.courseId, courses.id))
        .where(and(eq(courses.status, 'published'), isNull(courses.deletedAt)))
        .orderBy(desc(courseStats.popularityScore), desc(courseStats.weightedRating))
        .limit(limit)

      return rows
    },

    async resolveCourseId(coursePublicId) {
      const [row] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.publicId, coursePublicId), isNull(courses.deletedAt)))
        .limit(1)

      return row?.id ?? null
    },

    async findRatingSummary(courseId) {
      const [stats] = await db
        .select({
          averageRating: courseStats.averageRating,
          ratingCount: courseStats.ratingCount,
        })
        .from(courseStats)
        .where(eq(courseStats.courseId, courseId))
        .limit(1)

      if (!stats) return null

      const distributionRows = await db
        .select({
          rating: courseReviews.rating,
          cnt: count(),
        })
        .from(courseReviews)
        .where(
          and(
            eq(courseReviews.courseId, courseId),
            eq(courseReviews.moderationStatus, 'approved'),
            isNull(courseReviews.deletedAt),
          ),
        )
        .groupBy(courseReviews.rating)

      const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
      for (const row of distributionRows) {
        distribution[String(row.rating)] = row.cnt
      }

      return {
        courseId,
        averageRating: stats.averageRating,
        ratingCount: stats.ratingCount,
        distribution,
      }
    },

    async checkEnrollment(studentId, courseId) {
      const [row] = await db
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.studentId, studentId),
            eq(enrollments.courseId, courseId),
            isNull(enrollments.deletedAt),
          ),
        )
        .limit(1)

      return row !== undefined
    },

    async upsertRating(studentId, courseId, rating) {
      const existing = await db
        .select({ id: courseReviews.id })
        .from(courseReviews)
        .where(and(eq(courseReviews.studentId, studentId), eq(courseReviews.courseId, courseId)))
        .limit(1)

      if (existing[0]) {
        await db
          .update(courseReviews)
          .set({ rating, moderationStatus: 'pending' })
          .where(eq(courseReviews.id, existing[0].id))
      } else {
        await db.insert(courseReviews).values({
          studentId,
          courseId,
          rating,
          title: `Rating: ${rating}/5`,
          content: `User rated this course ${rating} out of 5 stars.`,
          moderationStatus: 'pending',
        })
      }

      await recalculateCourseStats(db, courseId)
    },

    async upsertReview(studentId, courseId, rating, title, content) {
      const existing = await db
        .select({ id: courseReviews.id })
        .from(courseReviews)
        .where(and(eq(courseReviews.studentId, studentId), eq(courseReviews.courseId, courseId)))
        .limit(1)

      if (existing[0]) {
        await db
          .update(courseReviews)
          .set({ rating, title, content, moderationStatus: 'pending' })
          .where(eq(courseReviews.id, existing[0].id))
        await recalculateCourseStats(db, courseId)
        return { isConflict: false }
      }

      await db.insert(courseReviews).values({
        studentId,
        courseId,
        rating,
        title,
        content,
        moderationStatus: 'pending',
      })

      await recalculateCourseStats(db, courseId)
      return { isConflict: false }
    },

    async findApprovedReviews(courseId, opts) {
      const { cursor, limit } = opts
      const effectiveLimit = limit + 1

      const conditions = [
        eq(courseReviews.courseId, courseId),
        eq(courseReviews.moderationStatus, 'approved'),
        isNull(courseReviews.deletedAt),
      ]

      const cursorId = decodeCursor(cursor)
      if (cursorId !== undefined) {
        conditions.push(lt(courseReviews.id, cursorId))
      }

      const rows = await db
        .select({
          id: courseReviews.id,
          reviewPublicId: courseReviews.publicId,
          courseId: courseReviews.courseId,
          rating: courseReviews.rating,
          title: courseReviews.title,
          content: courseReviews.content,
          createdAt: courseReviews.createdAt,
          studentDisplayName: users.name,
        })
        .from(courseReviews)
        .innerJoin(users, eq(courseReviews.studentId, users.id))
        .where(and(...conditions))
        .orderBy(desc(courseReviews.id))
        .limit(effectiveLimit)

      const hasMore = rows.length > limit
      const data = hasMore ? rows.slice(0, limit) : rows

      return {
        rows: data.map((row) => ({
          id: row.id,
          reviewId: row.reviewPublicId,
          courseId: row.courseId,
          studentDisplayName: row.studentDisplayName,
          rating: row.rating,
          title: row.title,
          content: row.content,
          createdAt: row.createdAt,
        })),
        hasMore,
      }
    },
  }
}

async function recalculateCourseStats(db: DatabaseClient, courseId: number) {
  const [agg] = await db
    .select({
      avgRating: sql<string>`ROUND(AVG(${courseReviews.rating})::numeric, 2)`,
      cnt: count(),
    })
    .from(courseReviews)
    .where(
      and(
        eq(courseReviews.courseId, courseId),
        eq(courseReviews.moderationStatus, 'approved'),
        isNull(courseReviews.deletedAt),
      ),
    )

  await db
    .update(courseStats)
    .set({
      averageRating: agg?.cnt ? agg.avgRating : null,
      ratingCount: agg?.cnt ?? 0,
      calculatedAt: new Date(),
    })
    .where(eq(courseStats.courseId, courseId))
}

export { encodeCursor, decodeCursor }
