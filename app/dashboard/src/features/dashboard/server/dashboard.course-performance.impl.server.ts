/**
 * Server-only implementation of the S-1.1 course performance table.
 * Never import from client code — pulls in the database client, Better Auth
 * server instance, and drizzle operators.
 *
 * Revision 2 of the spec adds the **state** column: the dashboard answers "what
 * needs me", so a draft shows how many items still need content and a course in
 * review shows how many decisions are pending. Revenue is selected only for a
 * role granted `finance.view_revenue`; for everyone else the column is dropped.
 */
import { and, asc, desc, eq, isNull, sql } from '@abugida/database'
import { courses, courseStats, lessons } from '@abugida/database/catalog'
import { enrollments } from '@abugida/database/learning'
import { reviewRequests } from '@abugida/database/ops'
import { purchases } from '@abugida/database/finance'
import { db } from '#/config/db.config'
import { z } from 'zod'
import { DATE_RANGE_PRESETS } from '../schemas/dashboard.date-range.schema'
import type {
  CourseLifecycle,
  CoursePerformancePage,
  CoursePerformanceSort,
} from '../dashboard.types'
import {
  canViewRevenue,
  requireDashboardOrganizationId,
  resolveDashboardRange,
} from './dashboard.server-helpers.server'

const COURSE_SORTS = ['revenue', 'students', 'completion'] as const

const coursePerformanceInputSchema = z.object({
  preset: z.enum(DATE_RANGE_PRESETS).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10),
  sort: z.enum(COURSE_SORTS).default('revenue'),
})

export const parseCoursePerformanceInput = (input: unknown) =>
  coursePerformanceInputSchema.parse(input)

function stateNote(
  state: CourseLifecycle,
  pendingReviews: number,
  emptyItems: number,
): string | undefined {
  if (state === 'in_review' && pendingReviews > 0) {
    return `${pendingReviews} pending ${pendingReviews === 1 ? 'decision' : 'decisions'}`
  }
  if (state === 'draft' && emptyItems > 0) {
    return `${emptyItems} ${emptyItems === 1 ? 'item needs' : 'items need'} content`
  }
  return undefined
}

export async function loadCoursePerformance(data: {
  preset?: (typeof DATE_RANGE_PRESETS)[number]
  from?: string
  to?: string
  page: number
  pageSize: number
  sort: CoursePerformanceSort
}): Promise<CoursePerformancePage> {
  const organizationId = await requireDashboardOrganizationId()
  const canSeeRevenue = await canViewRevenue()

  const { page, pageSize, sort, ...rangeInput } = data
  const range = await resolveDashboardRange(rangeInput)
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

  /** Open review requests — what the author is waiting on. */
  const pendingReviews = sql<number>`(
    SELECT COUNT(*)
    FROM ${reviewRequests} r
    WHERE r.course_id = ${courses.id}
      AND r.state = 'pending'
  )`

  /** Curriculum rows that exist but carry no content yet. */
  const emptyItems = sql<number>`(
    SELECT COUNT(*)
    FROM ${lessons} l
    WHERE l.course_id = ${courses.id}
      AND l.deleted_at IS NULL
      AND COALESCE(l.body, '') = ''
  )`

  const baseWhere = and(isNull(courses.deletedAt), eq(courses.organizationId, organizationId))

  // Roles without revenue access sort by the column they can actually see.
  const orderBy =
    sort === 'students'
      ? [desc(sql`COALESCE(${courseStats.totalEnrollments}, 0)`), asc(courses.title)]
      : sort === 'completion'
        ? [desc(sql`${completionPct} IS NULL`), desc(completionPct), asc(courses.title)]
        : [desc(revenueInRange), asc(courses.title)]

  const rows = await db
    .select({
      courseId: sql<string>`(${courses.publicId})::text`,
      title: courses.title,
      slug: courses.slug,
      state: sql<CourseLifecycle>`${courses.status}`,
      students: sql<number>`COALESCE(${courseStats.totalEnrollments}, 0)::int`,
      completionPct,
      revenue: revenueInRange,
      pendingReviews: sql<number>`${pendingReviews}::int`,
      emptyItems: sql<number>`${emptyItems}::int`,
    })
    .from(courses)
    .leftJoin(courseStats, eq(courseStats.courseId, courses.id))
    .where(baseWhere)
    .orderBy(...orderBy)
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
      state: row.state,
      ...(stateNote(row.state, row.pendingReviews, row.emptyItems)
        ? { stateNote: stateNote(row.state, row.pendingReviews, row.emptyItems) }
        : {}),
      students: Number(row.students),
      completionPct: row.completionPct != null ? Number(row.completionPct) : null,
      // Roles without revenue access get the table minus money.
      revenue: canSeeRevenue ? Number(row.revenue) : null,
    })),
    page,
    pageSize,
    totalRows,
    hasNextPage: offset + rows.length < totalRows,
    sort,
    canViewRevenue: canSeeRevenue,
  }
}
