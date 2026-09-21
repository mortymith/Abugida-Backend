/**
 * Server-only implementation of S-1.1 Analytics Overview.
 * Never import from client code — pulls in the database client, Better Auth
 * server instance, and drizzle operators.
 */
import { and, eq, gte, isNull, lt, sql } from '@abugida/database'
import { courses, courseStats } from '@abugida/database/catalog'
import { enrollments } from '@abugida/database/learning'
import { db } from '#/config/db.config'
import { auth } from '#/config/auth.server'
import { getRequest } from '@tanstack/react-start/server'
import { resolveDateRange, resolveTrendGranularity } from '../schemas/dashboard.date-range.schema'
import type { DateRange, TrendGranularity } from '../schemas/dashboard.date-range.schema'
import type { DashboardOverview, KpiMetric, TrendPoint, TrendSeries } from '../dashboard.types'
import { REVENUE_ROLES } from '#/features/auth'
import type { PlatformRole } from '#/features/auth'

function pctDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previous === 0) return current > 0 ? null : 0
  return ((current - previous) / Math.abs(previous)) * 100
}

async function getSessionRole(): Promise<PlatformRole> {
  const request = getRequest()
  const session = await auth.getSession(request.headers)
  if (!session.ok) return 'viewer'
  const { resolvePlatformRoleImpl } = await import('#/features/auth/server/auth.roles.impl.server')
  return resolvePlatformRoleImpl(session.value.user.id)
}

/** Sum of completed purchases in [from, to). */
async function sumCompletedRevenue(from: Date, to: Date): Promise<number> {
  const { purchases } = await import('@abugida/database/finance')
  const rows = await db
    .select({ total: sql<string>`COALESCE(SUM(${purchases.amount}), 0)` })
    .from(purchases)
    .where(
      and(
        eq(purchases.status, 'completed'),
        isNull(purchases.deletedAt),
        gte(purchases.completedAt, from),
        lt(purchases.completedAt, to),
      ),
    )
  return Number(rows.at(0)?.total ?? 0)
}

/** Distinct learners with an enrollment created in [from, to). */
async function countNewStudents(from: Date, to: Date): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${enrollments.studentId})::int` })
    .from(enrollments)
    .where(
      and(
        isNull(enrollments.deletedAt),
        gte(enrollments.createdAt, from),
        lt(enrollments.createdAt, to),
      ),
    )
  return Number(rows.at(0)?.count ?? 0)
}

export async function loadDashboardOverview(
  data: Parameters<typeof resolveDateRange>[0],
): Promise<DashboardOverview> {
  const role = await getSessionRole()
  const canSeeRevenue = REVENUE_ROLES.includes(role)
  const range = resolveDateRange(data)

  // ── KPI: Revenue ──────────────────────────────────────────────────────
  let revenueKpi: KpiMetric
  if (!canSeeRevenue) {
    revenueKpi = {
      id: 'revenue',
      label: 'Revenue',
      format: 'currency',
      value: null,
      deltaPct: null,
      availability: 'unsupported',
      note: 'Revenue is not available for your role.',
    }
  } else {
    const currentTotal = await sumCompletedRevenue(range.from, range.to)
    const previousTotal = await sumCompletedRevenue(range.prevFrom, range.prevTo)
    revenueKpi = {
      id: 'revenue',
      label: 'Revenue',
      format: 'currency',
      value: currentTotal,
      deltaPct: pctDelta(currentTotal, previousTotal),
      availability: currentTotal > 0 ? 'ok' : 'no_data',
    }
  }

  // ── KPI: Courses (total active + growth of created courses) ───────────
  const [coursesTotalRows, createdCurrentRows, createdPreviousRows] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(courses)
      .where(and(isNull(courses.deletedAt), sql`${courses.status} <> 'archived'`)),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(courses)
      .where(
        and(
          isNull(courses.deletedAt),
          gte(courses.createdAt, range.from),
          lt(courses.createdAt, range.to),
        ),
      ),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(courses)
      .where(
        and(
          isNull(courses.deletedAt),
          gte(courses.createdAt, range.prevFrom),
          lt(courses.createdAt, range.prevTo),
        ),
      ),
  ])

  const totalCourses = coursesTotalRows.at(0)?.count ?? 0
  const coursesKpi: KpiMetric = {
    id: 'courses',
    label: 'Courses',
    format: 'integer',
    value: totalCourses,
    deltaPct: pctDelta(createdCurrentRows.at(0)?.count ?? 0, createdPreviousRows.at(0)?.count ?? 0),
    availability: totalCourses > 0 ? 'ok' : 'no_data',
  }

  // ── KPI: Students (distinct learners + enrollment growth) ─────────────
  const [studentsTotalRows, newCurrentCount, newPreviousCount] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(DISTINCT ${enrollments.studentId})::int` })
      .from(enrollments)
      .where(isNull(enrollments.deletedAt)),
    countNewStudents(range.from, range.to),
    countNewStudents(range.prevFrom, range.prevTo),
  ])

  const totalStudents = studentsTotalRows.at(0)?.count ?? 0
  const studentsKpi: KpiMetric = {
    id: 'students',
    label: 'Students',
    format: 'integer',
    value: totalStudents,
    deltaPct: pctDelta(newCurrentCount, newPreviousCount),
    availability: totalStudents > 0 ? 'ok' : 'no_data',
  }

  // ── KPI: Avg Rating (snapshot; no reliable delta source yet) ──────────
  const ratingRows = await db
    .select({ avg: sql<string | null>`AVG(${courseStats.averageRating})` })
    .from(courseStats)
    .innerJoin(courses, eq(courseStats.courseId, courses.id))
    .where(isNull(courses.deletedAt))

  const avgRatingRaw = ratingRows.at(0)?.avg
  const avgRating = avgRatingRaw != null ? Number(avgRatingRaw) : null
  const avgRatingKpi: KpiMetric = {
    id: 'avgRating',
    label: 'Avg Rating',
    format: 'rating',
    value: avgRating,
    deltaPct: null,
    availability: avgRating == null ? 'no_data' : 'ok',
    note: 'Trend comparison is not available yet — rating history is being collected.',
  }

  // ── Trends ────────────────────────────────────────────────────────────
  const granularity = resolveTrendGranularity(range)
  const [revenueTrend, enrollmentTrend] = await Promise.all([
    buildRevenueTrend(range, granularity, canSeeRevenue),
    buildEnrollmentTrend(range, granularity),
  ])

  const kpis = [revenueKpi, coursesKpi, studentsKpi, avgRatingKpi]
  const isEmpty =
    kpis.every((kpi) => kpi.availability === 'no_data') &&
    revenueTrend.availability === 'no_data' &&
    enrollmentTrend.availability === 'no_data'

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString(), label: range.label },
    isEmpty,
    kpis,
    revenueTrend,
    enrollmentTrend,
  }
}

async function buildRevenueTrend(
  range: DateRange,
  granularity: TrendGranularity,
  canSeeRevenue: boolean,
): Promise<TrendSeries> {
  if (!canSeeRevenue) {
    return {
      availability: 'unsupported',
      granularity,
      points: [],
      note: 'Revenue is not available for your role.',
    }
  }

  const { purchases } = await import('@abugida/database/finance')
  const bucket = sql.raw(`'${granularity}'`)
  const rows = await db
    .select({
      bucket: sql<string>`date_trunc(${bucket}, ${purchases.completedAt})::timestamptz::text`,
      total: sql<string>`COALESCE(SUM(${purchases.amount}), 0)`,
    })
    .from(purchases)
    .where(
      and(
        eq(purchases.status, 'completed'),
        isNull(purchases.deletedAt),
        gte(purchases.completedAt, range.from),
        lt(purchases.completedAt, range.to),
      ),
    )
    .groupBy(sql`1`)
    .orderBy(sql`1`)

  return {
    availability: rows.length > 0 ? 'ok' : 'no_data',
    granularity,
    points: rows.map((row): TrendPoint => ({
      date: new Date(row.bucket).toISOString(),
      value: Number(row.total),
    })),
  }
}

async function buildEnrollmentTrend(
  range: DateRange,
  granularity: TrendGranularity,
): Promise<TrendSeries> {
  const bucket = sql.raw(`'${granularity}'`)
  const rows = await db
    .select({
      bucket: sql<string>`date_trunc(${bucket}, ${enrollments.createdAt})::timestamptz::text`,
      total: sql<number>`COUNT(*)::int`,
    })
    .from(enrollments)
    .where(
      and(
        isNull(enrollments.deletedAt),
        gte(enrollments.createdAt, range.from),
        lt(enrollments.createdAt, range.to),
      ),
    )
    .groupBy(sql`1`)
    .orderBy(sql`1`)

  return {
    availability: rows.length > 0 ? 'ok' : 'no_data',
    granularity,
    points: rows.map((row): TrendPoint => ({
      date: new Date(row.bucket).toISOString(),
      value: Number(row.total),
    })),
  }
}
