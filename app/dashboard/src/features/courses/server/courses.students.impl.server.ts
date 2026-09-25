/**
 * Server-only implementation: course students tab (S-2.6) + light analytics.
 */
import { and, asc, desc, eq, ilike, isNull, or, sql } from '@abugida/database'
import { lessons, modules, courseStats } from '@abugida/database/catalog'
import { enrollments } from '@abugida/database/learning'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import { escapeLike, requireUserId, resolveCourse } from './courses.server-helpers.server'
import type { CourseAnalyticsDTO, CourseStudentsResult } from '../courses.types'

const PAGE_SIZE = 25

export async function getCourseStudentsImpl(input: {
  coursePublicId: string
  search?: string
  page: number
}): Promise<CourseStudentsResult> {
  await requireUserId()
  const course = await resolveCourse(input.coursePublicId)

  const filters = [eq(enrollments.courseId, course.id), isNull(enrollments.deletedAt)]
  if (input.search && input.search.trim()) {
    const pattern = `%${escapeLike(input.search.trim())}%`
    filters.push(
      or(ilike(users.name, pattern), ilike(users.email, pattern)) ?? isNull(enrollments.id),
    )
  }

  const rows = await db
    .select({
      enrollmentPublicId: enrollments.publicId,
      studentName: users.name,
      studentEmail: users.email,
      progressPercentage: enrollments.progressPercentage,
      isCompleted: enrollments.isCompleted,
      completedAt: enrollments.completedAt,
      lastAccessedAt: enrollments.lastAccessedAt,
    })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.studentId))
    .where(and(...filters))
    .orderBy(desc(enrollments.progressPercentage), asc(users.name))
    .limit(PAGE_SIZE + 1)
    .offset(input.page * PAGE_SIZE)

  const totalRows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.studentId))
    .where(and(...filters))

  return {
    items: rows.slice(0, PAGE_SIZE).map((row) => ({
      enrollmentPublicId: row.enrollmentPublicId,
      studentName: row.studentName ?? 'Unknown student',
      studentEmail: row.studentEmail ?? '',
      progressPercentage: row.progressPercentage,
      isCompleted: row.isCompleted,
      completedAt: row.completedAt?.toISOString() ?? null,
      lastAccessedAt: row.lastAccessedAt?.toISOString() ?? null,
    })),
    totalCount: Number(totalRows.at(0)?.count ?? 0),
  }
}

export async function getCourseAnalyticsImpl(coursePublicId: string): Promise<CourseAnalyticsDTO> {
  await requireUserId()
  const course = await resolveCourse(coursePublicId)

  const [statsRows, moduleRows, lessonCountRows, completionRows] = await Promise.all([
    db.select().from(courseStats).where(eq(courseStats.courseId, course.id)).limit(1),
    db
      .select({
        publicId: modules.publicId,
        title: modules.title,
        sortOrder: modules.sortOrder,
      })
      .from(modules)
      .where(and(eq(modules.courseId, course.id), isNull(modules.deletedAt)))
      .orderBy(asc(modules.sortOrder)),
    db
      .select({
        publicId: modules.publicId,
        count: sql<number>`COUNT(${lessons.id})::int`,
      })
      .from(modules)
      .leftJoin(lessons, and(eq(lessons.moduleId, modules.id), isNull(lessons.deletedAt)))
      .where(and(eq(modules.courseId, course.id), isNull(modules.deletedAt)))
      .groupBy(modules.publicId),
    db
      .select({
        total: sql<number>`COUNT(*)::int`,
        completed: sql<number>`COUNT(*) FILTER (WHERE ${enrollments.isCompleted})::int`,
        avgProgress: sql<number>`COALESCE(AVG(${enrollments.progressPercentage}), 0)`,
      })
      .from(enrollments)
      .where(and(eq(enrollments.courseId, course.id), isNull(enrollments.deletedAt))),
  ])

  const stats = statsRows.at(0)
  const completion = completionRows.at(0)
  const lessonCountByModule = new Map(lessonCountRows.map((row) => [row.publicId, row.count]))

  return {
    studentCount: Number(stats?.totalEnrollments ?? completion?.total ?? 0),
    activeStudents7d: Number(stats?.activeStudents7d ?? 0),
    averageRating: stats?.averageRating == null ? null : Number(stats.averageRating),
    ratingCount: Number(stats?.ratingCount ?? 0),
    completionRate:
      completion && Number(completion.total) > 0
        ? Math.round((Number(completion.completed) / Number(completion.total)) * 100)
        : null,
    moduleBreakdown: moduleRows.map((module) => ({
      moduleTitle: module.title,
      lessonCount: Number(lessonCountByModule.get(module.publicId) ?? 0),
      avgProgress:
        completion && Number(completion.total) > 0
          ? Math.round(Number(completion.avgProgress))
          : null,
    })),
  }
}
