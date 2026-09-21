/**
 * Server-only implementation of the S-1.1 course performance table.
 * Never import from client code — pulls in the database client, Better Auth
 * server instance, and drizzle operators.
 */
import { and, asc, desc, eq, isNull, sql } from '@abugida/database'
import { courses, courseStats } from '@abugida/database/catalog'
import { enrollments } from '@abugida/database/learning'
import { purchases } from '@abugida/database/finance'
import { db } from '#/config/db.config'
import { auth } from '#/config/auth.server'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { resolveDateRange, DATE_RANGE_PRESETS } from '../schemas/dashboard.date-range.schema'
import type { CoursePerformancePage } from '../dashboard.types'
import { REVENUE_ROLES } from '#/features/auth'
import type { PlatformRole } from '#/features/auth'
import { resolvePlatformRoleImpl } from '#/features/auth/server/auth.roles.impl.server'

const coursePerformanceInputSchema = z.object({
  preset: z.enum(DATE_RANGE_PRESETS).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10),
})

export const parseCoursePerformanceInput = (input: unknown) =>
  coursePerformanceInputSchema.parse(input)

export async function loadCoursePerformance(data: {
  preset?: (typeof DATE_RANGE_PRESETS)[number]
  from?: string
  to?: string
  page: number
  pageSize: number
}): Promise<CoursePerformancePage> {
  const request = getRequest()
  const session = await auth.getSession(request.headers)
  const role: PlatformRole = session.ok
    ? await resolvePlatformRoleImpl(session.value.user.id)
    : 'viewer'
  const canSeeRevenue = REVENUE_ROLES.includes(role)

  const { page, pageSize, ...rangeInput } = data
  const range = resolveDateRange(rangeInput)
  const offset = (page - 1) * pageSize

  // Correlated aggregates keep one query per page instead of N+1.
  const revenueInRange = sql<string>`(
    SELECT COALESCE(SUM(p.amount), 0)
    FROM ${purchases} p
    WHERE p.course_id = ${courses.id}
      AND p.status = 'completed'
      AND p.deleted_at IS NULL
      AND p.completed_at >= ${range.from}
      AND p.completed_at < ${range.to}
  )`

  const completionPct = sql<string | null>`(
    SELECT ROUND(AVG(e.progress_percentage))
    FROM ${enrollments} e
    WHERE e.course_id = ${courses.id}
      AND e.deleted_at IS NULL
  )`

  const baseWhere = and(isNull(courses.deletedAt), eq(courses.status, 'published'))

  const rows = await db
    .select({
      courseId: sql<string>`(${courses.publicId})::text`,
      title: courses.title,
      slug: courses.slug,
      students: sql<number>`COALESCE(${courseStats.totalEnrollments}, 0)::int`,
      completionPct,
      revenue: revenueInRange,
    })
    .from(courses)
    .leftJoin(courseStats, eq(courseStats.courseId, courses.id))
    .where(baseWhere)
    .orderBy(desc(revenueInRange), asc(courses.title))
    .limit(pageSize)
    .offset(offset)

  const countRows = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(courses)
    .where(baseWhere)

  const totalRows = countRows.at(0)?.total ?? 0

  return {
    rows: rows.map((row) => ({
      courseId: row.courseId,
      title: row.title,
      slug: row.slug,
      students: Number(row.students),
      completionPct: row.completionPct != null ? Number(row.completionPct) : null,
      // Roles without revenue access still get the table, minus money.
      revenue: canSeeRevenue ? Number(row.revenue) : null,
    })),
    page,
    pageSize,
    totalRows,
    hasNextPage: offset + rows.length < totalRows,
  }
}
