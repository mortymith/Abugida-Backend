import { createServerFn } from '@tanstack/react-start'
import { and, eq, gte, isNull, lt, sql } from '@abugida/database'
import type { DatabaseClient } from '@abugida/database/client'
import {
  dateRangeInputSchema,
  resolveDateRange,
  resolveTrendGranularity,
} from '../schemas/dashboard.date-range.schema'
import type { DateRange, TrendGranularity } from '../schemas/dashboard.date-range.schema'
import type { DashboardOverview, KpiMetric, TrendPoint, TrendSeries } from '../dashboard.types'
import { REVENUE_ROLES } from '#/features/auth'
import type { PlatformRole } from '#/features/auth'

function pctDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previous === 0) return current > 0 ? null : 0
  return ((current - previous) / Math.abs(previous)) * 100
}

/** Sum of completed purchases in [from, to). */
async function sumCompletedRevenue(db: DatabaseClient, from: Date, to: Date): Promise<number> {
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

/** Distinct learners with at least one enrollment, created in [from, to). */
async function countNewStudents(db: DatabaseClient, from: Date, to: Date): Promise<number> {
  const { enrollments } = await import('@abugida/database/learning')
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

export const getDashboardOverview = createServerFn({ method: 'GET' })
  .validator((input: unknown) => dateRangeInputSchema.parse(input))
  .handler(async ({ data }): Promise<DashboardOverview> => {
    const { db } = await import('#/config/db.config')
    const { courses, courseStats } = await import('@abugida/database/catalog')

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
      const currentTotal = await sumCompletedRevenue(db, range.from, range.to)
      const previousTotal = await sumCompletedRevenue(db, range.prevFrom, range.prevTo)
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
      deltaPct: pctDelta(
        createdCurrentRows.at(0)?.count ?? 0,
        createdPreviousRows.at(0)?.count ?? 0,
      ),
      availability: totalCourses > 0 ? 'ok' : 'no_data',
    }

    // ── KPI: Students (distinct learners + enrollment growth) ─────────────
    const { enrollments } = await import('@abugida/database/learning')
    const [studentsTotalRows, newCurrentRows, newPreviousRows] = await Promise.all([
      db
        .select({ count: sql<number>`COUNT(DISTINCT ${enrollments.studentId})::int` })
        .from(enrollments)
        .where(isNull(enrollments.deletedAt)),
      countNewStudents(db, range.from, range.to).then((count) => [{ count }]),
      countNewStudents(db, range.prevFrom, range.prevTo).then((count) => [{ count }]),
    ])

    const totalStudents = studentsTotalRows.at(0)?.count ?? 0
    const studentsKpi: KpiMetric = {
      id: 'students',
      label: 'Students',
      format: 'integer',
      value: totalStudents,
      deltaPct: pctDelta(newCurrentRows.at(0)?.count ?? 0, newPreviousRows.at(0)?.count ?? 0),
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
    const revenueTrend = await buildRevenueTrend(db, range, granularity, canSeeRevenue)
    const enrollmentTrend = await buildEnrollmentTrend(db, range, granularity)

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
  })

async function getSessionRole(): Promise<PlatformRole> {
  const [{ getRequest }, { auth }, { resolvePlatformRole }] = await Promise.all([
    import('@tanstack/react-start/server'),
    import('#/config/auth.server'),
    import('#/features/auth/server/auth.roles.server'),
  ])
  const request = getRequest()
  const session = await auth.getSession(request.headers)
  if (!session.ok) return 'viewer'
  return resolvePlatformRole(session.value.user.id)
}

async function buildRevenueTrend(
  db: DatabaseClient,
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
  db: DatabaseClient,
  range: DateRange,
  granularity: TrendGranularity,
): Promise<TrendSeries> {
  const { enrollments } = await import('@abugida/database/learning')
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
