/**
 * @module enrollments.repository
 *
 * Database operations for the enrollments feature module. Handles enrollment
 * CRUD, lesson completion tracking, and progress aggregation queries.
 */

import { eq, and, desc, sql, lt, count } from 'drizzle-orm'
import type { DatabaseClient } from '@abugida/database/client'
import { users } from '@abugida/database/auth'
import { enrollments } from '@abugida/database/learning'
import { lessonCompletions } from '@abugida/database/learning'
import { courses } from '@abugida/database/catalog'
import { lessons } from '@abugida/database/catalog'
import { courseBundles } from '@abugida/database/catalog'
import { purchases } from '@abugida/database/finance'

// ── Cursor helpers ─────────────────────────────────────────────────────────

export function encodeCursor(id: number): string {
  return Buffer.from(`cursor:${id}`).toString('base64url')
}

export function decodeCursor(cursor: string | undefined): number | undefined {
  if (!cursor) return undefined
  const decoded = Buffer.from(cursor, 'base64url').toString('utf-8')
  const match = decoded.match(/^cursor:(\d+)$/)
  if (!match?.[1]) throw new Error('Invalid cursor format')
  return Number.parseInt(match[1], 10)
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface EnrollmentRow {
  id: number
  publicId: string
  studentId: string
  courseId: number
  purchaseId: number | null
  bundleId: number | null
  enrollmentSource: string | null
  progressPercentage: string
  isCompleted: boolean
  completedAt: Date | null
  lastAccessedAt: Date | null
  rowVersion: number
  createdAt: Date
  updatedAt: Date
}

export interface EnrollmentWithCourse extends EnrollmentRow {
  coursePublicId: string
  purchasePublicId: string | null
  bundlePublicId: string | null
}

export interface EnrollmentDetailRow extends EnrollmentWithCourse {
  bundleName: string | null
  totalLessons: number
  completedLessons: number
}

export interface LessonCompletionRow {
  id: number
  publicId: string
  studentId: string
  lessonId: number
  enrollmentId: number
  isCompleted: boolean
  completedAt: Date | null
  timeSpentSeconds: number | null
  rowVersion: number
  createdAt: Date
  updatedAt: Date
  lessonPublicId: string
  enrollmentPublicId: string
}

export interface ProgressStatsRow {
  totalEnrollments: number
  activeEnrollments: number
  completedEnrollments: number
  totalLessonsCompleted: number
  totalStudyTimeSeconds: number
}

// ── Repository interface ───────────────────────────────────────────────────

export interface EnrollmentsRepository {
  findUserIdByPublicId(publicId: string): Promise<string | undefined>
  getEnrollments(
    studentId: string,
    opts: {
      cursor: string | undefined
      limit: number
      status: string | undefined
      source: string | undefined
    },
  ): Promise<{ rows: EnrollmentWithCourse[]; hasMore: boolean }>
  findEnrollmentByPublicId(
    studentId: string,
    enrollmentPublicId: string,
  ): Promise<EnrollmentDetailRow | undefined>
  getLessonCompletions(
    studentId: string,
    enrollmentPublicId: string,
    opts: { cursor: string | undefined; limit: number },
  ): Promise<{ rows: LessonCompletionRow[]; hasMore: boolean }>
  findLessonCompletion(
    studentId: string,
    enrollmentPublicId: string,
    lessonPublicId: string,
  ): Promise<LessonCompletionRow | undefined>
  toggleLessonCompletion(
    studentId: string,
    enrollmentPublicId: string,
    lessonPublicId: string,
    isCompleted: boolean,
    timeSpentSeconds?: number,
  ): Promise<LessonCompletionRow>
  getProgressStats(studentId: string): Promise<ProgressStatsRow>
  getCompletedLessonCount(enrollmentId: number): Promise<number>
  incrementRowVersion(enrollmentId: number): Promise<void>
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createEnrollmentsRepository(db: DatabaseClient): EnrollmentsRepository {
  return {
    async findUserIdByPublicId(publicId) {
      const [row] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, publicId))
        .limit(1)
      return row?.id
    },

    async getEnrollments(studentId, opts) {
      const { cursor, limit, status, source } = opts
      const effectiveLimit = limit + 1

      const conditions = [eq(enrollments.studentId, studentId)]

      if (status) {
        if (status === 'NOT_STARTED') {
          conditions.push(eq(enrollments.isCompleted, false))
          conditions.push(sql`${enrollments.progressPercentage} = 0`)
        } else if (status === 'IN_PROGRESS') {
          conditions.push(eq(enrollments.isCompleted, false))
          conditions.push(sql`${enrollments.progressPercentage} > 0`)
        } else if (status === 'COMPLETED') {
          conditions.push(eq(enrollments.isCompleted, true))
        }
      }

      if (source) {
        conditions.push(
          eq(
            enrollments.enrollmentSource,
            source.toLowerCase() as
              'purchase' | 'bundle_purchase' | 'free_access' | 'admin_grant' | 'preview',
          ),
        )
      }

      const cursorId = decodeCursor(cursor)
      if (cursorId !== undefined) {
        conditions.push(lt(enrollments.id, cursorId))
      }

      const rows = await db
        .select({
          id: enrollments.id,
          publicId: enrollments.publicId,
          studentId: enrollments.studentId,
          courseId: enrollments.courseId,
          purchaseId: enrollments.purchaseId,
          bundleId: enrollments.bundleId,
          enrollmentSource: enrollments.enrollmentSource,
          progressPercentage: enrollments.progressPercentage,
          isCompleted: enrollments.isCompleted,
          completedAt: enrollments.completedAt,
          lastAccessedAt: enrollments.lastAccessedAt,
          rowVersion: enrollments.rowVersion,
          createdAt: enrollments.createdAt,
          updatedAt: enrollments.updatedAt,
          coursePublicId: courses.publicId,
          purchasePublicId: purchases.publicId,
          bundlePublicId: courseBundles.publicId,
        })
        .from(enrollments)
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .leftJoin(purchases, eq(enrollments.purchaseId, purchases.id))
        .leftJoin(courseBundles, eq(enrollments.bundleId, courseBundles.id))
        .where(and(...conditions))
        .orderBy(desc(enrollments.id))
        .limit(effectiveLimit)

      const hasMore = rows.length > limit
      const data = hasMore ? rows.slice(0, limit) : rows

      return { rows: data, hasMore }
    },

    async findEnrollmentByPublicId(studentId, enrollmentPublicId) {
      const [row] = await db
        .select({
          id: enrollments.id,
          publicId: enrollments.publicId,
          studentId: enrollments.studentId,
          courseId: enrollments.courseId,
          purchaseId: enrollments.purchaseId,
          bundleId: enrollments.bundleId,
          enrollmentSource: enrollments.enrollmentSource,
          progressPercentage: enrollments.progressPercentage,
          isCompleted: enrollments.isCompleted,
          completedAt: enrollments.completedAt,
          lastAccessedAt: enrollments.lastAccessedAt,
          rowVersion: enrollments.rowVersion,
          createdAt: enrollments.createdAt,
          updatedAt: enrollments.updatedAt,
          coursePublicId: courses.publicId,
          purchasePublicId: purchases.publicId,
          bundlePublicId: courseBundles.publicId,
          bundleName: courseBundles.title,
        })
        .from(enrollments)
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .leftJoin(purchases, eq(enrollments.purchaseId, purchases.id))
        .leftJoin(courseBundles, eq(enrollments.bundleId, courseBundles.id))
        .where(
          and(eq(enrollments.studentId, studentId), eq(enrollments.publicId, enrollmentPublicId)),
        )
        .limit(1)

      if (!row) return undefined

      const totalLessons = await getLessonCountForCourse(db, row.courseId)
      const completedLessons = await getCompletedLessonCount(db, row.id)

      return { ...row, totalLessons, completedLessons }
    },

    async getLessonCompletions(studentId, enrollmentPublicId, opts) {
      const { cursor, limit } = opts
      const effectiveLimit = limit + 1

      const enrollment = await getEnrollmentInternal(db, studentId, enrollmentPublicId)
      if (!enrollment) return { rows: [], hasMore: false }

      const conditions = [eq(lessonCompletions.enrollmentId, enrollment.id)]

      const cursorId = decodeCursor(cursor)
      if (cursorId !== undefined) {
        conditions.push(lt(lessonCompletions.id, cursorId))
      }

      const rows = await db
        .select({
          id: lessonCompletions.id,
          publicId: lessonCompletions.publicId,
          studentId: lessonCompletions.studentId,
          lessonId: lessonCompletions.lessonId,
          enrollmentId: lessonCompletions.enrollmentId,
          isCompleted: lessonCompletions.isCompleted,
          completedAt: lessonCompletions.completedAt,
          timeSpentSeconds: lessonCompletions.timeSpentSeconds,
          rowVersion: lessonCompletions.rowVersion,
          createdAt: lessonCompletions.createdAt,
          updatedAt: lessonCompletions.updatedAt,
          lessonPublicId: lessons.publicId,
          enrollmentPublicId: enrollments.publicId,
        })
        .from(lessonCompletions)
        .innerJoin(lessons, eq(lessonCompletions.lessonId, lessons.id))
        .innerJoin(enrollments, eq(lessonCompletions.enrollmentId, enrollments.id))
        .where(and(...conditions))
        .orderBy(desc(lessonCompletions.id))
        .limit(effectiveLimit)

      const hasMore = rows.length > limit
      const data = hasMore ? rows.slice(0, limit) : rows

      return { rows: data, hasMore }
    },

    async findLessonCompletion(studentId, enrollmentPublicId, lessonPublicId) {
      const enrollment = await getEnrollmentInternal(db, studentId, enrollmentPublicId)
      if (!enrollment) return undefined

      const lessonId = await getLessonIdByPublicId(db, lessonPublicId)
      if (!lessonId) return undefined

      const [row] = await db
        .select({
          id: lessonCompletions.id,
          publicId: lessonCompletions.publicId,
          studentId: lessonCompletions.studentId,
          lessonId: lessonCompletions.lessonId,
          enrollmentId: lessonCompletions.enrollmentId,
          isCompleted: lessonCompletions.isCompleted,
          completedAt: lessonCompletions.completedAt,
          timeSpentSeconds: lessonCompletions.timeSpentSeconds,
          rowVersion: lessonCompletions.rowVersion,
          createdAt: lessonCompletions.createdAt,
          updatedAt: lessonCompletions.updatedAt,
          lessonPublicId: lessons.publicId,
          enrollmentPublicId: enrollments.publicId,
        })
        .from(lessonCompletions)
        .innerJoin(lessons, eq(lessonCompletions.lessonId, lessons.id))
        .innerJoin(enrollments, eq(lessonCompletions.enrollmentId, enrollments.id))
        .where(
          and(
            eq(lessonCompletions.enrollmentId, enrollment.id),
            eq(lessonCompletions.lessonId, lessonId),
          ),
        )
        .limit(1)

      return row
    },

    async toggleLessonCompletion(
      studentId,
      enrollmentPublicId,
      lessonPublicId,
      isCompleted,
      timeSpentSeconds,
    ) {
      const enrollment = await getEnrollmentInternal(db, studentId, enrollmentPublicId)
      if (!enrollment) throw new Error('Enrollment not found')

      const lessonId = await getLessonIdByPublicId(db, lessonPublicId)
      if (!lessonId) throw new Error('Lesson not found')

      const existing = await db
        .select()
        .from(lessonCompletions)
        .where(
          and(
            eq(lessonCompletions.enrollmentId, enrollment.id),
            eq(lessonCompletions.lessonId, lessonId),
          ),
        )
        .limit(1)

      if (existing.length > 0) {
        const [updated] = await db
          .update(lessonCompletions)
          .set({
            isCompleted,
            completedAt: isCompleted ? new Date() : null,
            timeSpentSeconds: timeSpentSeconds ?? existing[0]!.timeSpentSeconds,
            rowVersion: existing[0]!.rowVersion + 1,
          })
          .where(eq(lessonCompletions.id, existing[0]!.id))
          .returning()

        return {
          id: updated!.id,
          publicId: updated!.publicId,
          studentId: updated!.studentId,
          lessonId: updated!.lessonId,
          enrollmentId: updated!.enrollmentId,
          isCompleted: updated!.isCompleted,
          completedAt: updated!.completedAt,
          timeSpentSeconds: updated!.timeSpentSeconds,
          rowVersion: updated!.rowVersion,
          createdAt: updated!.createdAt,
          updatedAt: updated!.updatedAt,
          lessonPublicId,
          enrollmentPublicId,
        }
      }

      const [created] = await db
        .insert(lessonCompletions)
        .values({
          studentId: enrollment.studentId,
          lessonId,
          enrollmentId: enrollment.id,
          isCompleted,
          completedAt: isCompleted ? new Date() : null,
          timeSpentSeconds: timeSpentSeconds ?? null,
        })
        .returning()

      return {
        id: created!.id,
        publicId: created!.publicId,
        studentId: created!.studentId,
        lessonId: created!.lessonId,
        enrollmentId: created!.enrollmentId,
        isCompleted: created!.isCompleted,
        completedAt: created!.completedAt,
        timeSpentSeconds: created!.timeSpentSeconds,
        rowVersion: created!.rowVersion,
        createdAt: created!.createdAt,
        updatedAt: created!.updatedAt,
        lessonPublicId,
        enrollmentPublicId,
      }
    },

    async getProgressStats(studentId) {
      const [enrollmentStats] = await db
        .select({
          totalEnrollments: count(),
          activeEnrollments: sql<number>`count(case when ${enrollments.isCompleted} = false then 1 end)::int`,
          completedEnrollments: sql<number>`count(case when ${enrollments.isCompleted} = true then 1 end)::int`,
        })
        .from(enrollments)
        .where(eq(enrollments.studentId, studentId))

      const [completionStats] = await db
        .select({
          totalLessonsCompleted: count(),
          totalStudyTimeSeconds: sql<number>`coalesce(sum(${lessonCompletions.timeSpentSeconds}), 0)::int`,
        })
        .from(lessonCompletions)
        .innerJoin(enrollments, eq(lessonCompletions.enrollmentId, enrollments.id))
        .where(and(eq(enrollments.studentId, studentId), eq(lessonCompletions.isCompleted, true)))

      return {
        totalEnrollments: enrollmentStats?.totalEnrollments ?? 0,
        activeEnrollments: enrollmentStats?.activeEnrollments ?? 0,
        completedEnrollments: enrollmentStats?.completedEnrollments ?? 0,
        totalLessonsCompleted: completionStats?.totalLessonsCompleted ?? 0,
        totalStudyTimeSeconds: completionStats?.totalStudyTimeSeconds ?? 0,
      }
    },

    async getCompletedLessonCount(enrollmentId) {
      return getCompletedLessonCount(db, enrollmentId)
    },

    async incrementRowVersion(enrollmentId) {
      await db
        .update(enrollments)
        .set({ rowVersion: sql`${enrollments.rowVersion} + 1` })
        .where(eq(enrollments.id, enrollmentId))
    },
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────

async function getEnrollmentInternal(
  db: DatabaseClient,
  studentId: string,
  enrollmentPublicId: string,
) {
  const [row] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.studentId, studentId), eq(enrollments.publicId, enrollmentPublicId)))
    .limit(1)
  return row
}

async function getLessonIdByPublicId(db: DatabaseClient, publicId: string) {
  const [row] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.publicId, publicId))
    .limit(1)
  return row?.id
}

async function getLessonCountForCourse(db: DatabaseClient, courseId: number) {
  const [result] = await db
    .select({ count: count() })
    .from(lessons)
    .where(eq(lessons.courseId, courseId))
  return result?.count ?? 0
}

async function getCompletedLessonCount(db: DatabaseClient, enrollmentId: number) {
  const [result] = await db
    .select({ count: count() })
    .from(lessonCompletions)
    .where(
      and(
        eq(lessonCompletions.enrollmentId, enrollmentId),
        eq(lessonCompletions.isCompleted, true),
      ),
    )
  return result?.count ?? 0
}
