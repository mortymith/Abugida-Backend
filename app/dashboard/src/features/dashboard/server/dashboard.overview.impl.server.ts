/**
 * Server-only implementation of S-1.1 Analytics Overview.
 * Never import from client code — pulls in the database client, Better Auth
 * server instance, and drizzle operators.
 *
 * Three rules shape everything below:
 *
 * 1. **Revenue is redacted in the query, not the view.** A role without
 *    `finance.view_revenue` gets `value: null` plus `restricted: true`; the
 *    figure is never selected, never serialized, never hidden by CSS.
 * 2. **One range governs the whole screen**, and every KPI states the comparison
 *    basis it used.
 * 3. **Cards fail independently.** A failing revenue query marks the revenue
 *    card `error` and leaves the rest of the screen current.
 */
import { and, eq, gte, isNull, lt, sql } from '@abugida/database'
import { courses, courseStats } from '@abugida/database/catalog'
import { purchases } from '@abugida/database/finance'
import { enrollments } from '@abugida/database/learning'
import { db } from '#/config/db.config'
import {
  resolveTrendGranularity,
  REPORTING_TIME_ZONE,
} from '../schemas/dashboard.date-range.schema'
import type {
  DateRange,
  DateRangeInput,
  TrendGranularity,
} from '../schemas/dashboard.date-range.schema'
import type {
  DashboardOverview,
  DashboardRangeInfo,
  KpiMetric,
  TrendPoint,
  TrendSeries,
} from '../dashboard.types'
import { comparisonDelta } from '../dashboard.metric-math'
import {
  canViewRevenue,
  getDashboardRole,
  requireDashboardOrganizationId,
  resolveDashboardRange,
} from './dashboard.server-helpers.server'

const REVENUE_RESTRICTED_NOTE =
  'Revenue is limited to Admins and Editors. Ask an Admin if you need this figure.'

function toRangeInfo(range: DateRange): DashboardRangeInfo {
  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    label: range.label,
    comparisonLabel: range.comparisonLabel,
    ...(range.partialDayNote ? { partialDayNote: range.partialDayNote } : {}),
  }
}

interface RevenueTotals {
  total: number
  transactions: number
}

/**
 * Completed purchase totals for the active workspace in `[from, to)`.
 *
 * Scoped through `courses.organizationId`: `purchases` itself carries no
 * organization column, so a purchase is attributed to a workspace by the course
 * it bought. Bundle purchases (no course) therefore contribute nothing here —
 * they cannot be attributed to a workspace without leaking another one's rows.
 */
async function revenueTotals(organizationId: string, from: Date, to: Date): Promise<RevenueTotals> {
  const rows = await db
    .select({
      total: sql<string>`COALESCE(SUM(${purchases.amount}), 0)`,
      transactions: sql<number>`COUNT(*)::int`,
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(
      and(
        eq(purchases.status, 'completed'),
        isNull(purchases.deletedAt),
        eq(courses.organizationId, organizationId),
        isNull(courses.deletedAt),
        gte(purchases.completedAt, from),
        lt(purchases.completedAt, to),
      ),
    )
  return {
    total: Number(rows.at(0)?.total ?? 0),
    transactions: rows.at(0)?.transactions ?? 0,
  }
}

async function revenueTrend(
  organizationId: string,
  range: DateRange,
  granularity: TrendGranularity,
): Promise<TrendSeries> {
  const bucket = sql.raw(`'${granularity}'`)
  const rows = await db
    .select({
      // The zone is bound as a parameter, never spliced into the string: `'${…}'`
      // inside a `sql` template produces a *parameter inside quotes*
      // (`AT TIME ZONE '$1'`), which Postgres rejects as an unknown zone.
      bucket: sql<string>`date_trunc(${bucket}, ${purchases.completedAt} AT TIME ZONE ${REPORTING_TIME_ZONE})::text`,
      total: sql<string>`COALESCE(SUM(${purchases.amount}), 0)`,
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(
      and(
        eq(purchases.status, 'completed'),
        isNull(purchases.deletedAt),
        eq(courses.organizationId, organizationId),
        isNull(courses.deletedAt),
        gte(purchases.completedAt, range.from),
        lt(purchases.completedAt, range.to),
      ),
    )
    .groupBy(sql`1`)
    .orderBy(sql`1`)

  const points = rows.map((row): TrendPoint => ({
    date: `${row.bucket}Z`,
    value: Number(row.total),
  }))
  return { availability: points.length > 0 ? 'ok' : 'no_data', granularity, points }
}

async function enrollmentSeries(
  organizationId: string,
  range: DateRange,
  granularity: TrendGranularity,
): Promise<TrendSeries> {
  const bucket = sql.raw(`'${granularity}'`)
  const rows = await db
    .select({
      bucket: sql<string>`date_trunc(${bucket}, ${enrollments.createdAt} AT TIME ZONE ${REPORTING_TIME_ZONE})::text`,
      total: sql<number>`COUNT(*)::int`,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(
      and(
        isNull(enrollments.deletedAt),
        eq(courses.organizationId, organizationId),
        isNull(courses.deletedAt),
        gte(enrollments.createdAt, range.from),
        lt(enrollments.createdAt, range.to),
      ),
    )
    .groupBy(sql`1`)
    .orderBy(sql`1`)

  const points = rows.map((row): TrendPoint => ({
    date: `${row.bucket}Z`,
    value: Number(row.total),
  }))
  return { availability: points.length > 0 ? 'ok' : 'no_data', granularity, points }
}

export async function loadDashboardOverview(data: DateRangeInput): Promise<DashboardOverview> {
  await getDashboardRole()
  const organizationId = await requireDashboardOrganizationId()
  const range = await resolveDashboardRange(data)
  const canSeeRevenue = await canViewRevenue()
  const granularity = resolveTrendGranularity(range)

  // ── Revenue card + trend (independent failure, redacted for the role) ──
  let revenueKpi: KpiMetric
  let revenueSeries: TrendSeries
  if (!canSeeRevenue) {
    revenueKpi = {
      id: 'revenue',
      label: 'Revenue',
      format: 'currency',
      value: null,
      deltaPct: null,
      availability: 'no_data',
      restricted: true,
      note: REVENUE_RESTRICTED_NOTE,
    }
    revenueSeries = {
      availability: 'no_data',
      granularity,
      points: [],
      note: REVENUE_RESTRICTED_NOTE,
    }
  } else {
    try {
      const [current, previous] = await Promise.all([
        revenueTotals(organizationId, range.from, range.to),
        revenueTotals(organizationId, range.prevFrom, range.prevTo),
      ])
      revenueKpi = {
        id: 'revenue',
        label: 'Revenue',
        format: 'currency',
        value: current.total,
        deltaPct: comparisonDelta({
          current: current.total,
          previous: previous.total,
          previousSample: previous.transactions,
        }),
        availability: current.total > 0 ? 'ok' : 'no_data',
        comparisonSample: previous.transactions,
      }
      revenueSeries = await revenueTrend(organizationId, range, granularity)
    } catch {
      revenueKpi = {
        id: 'revenue',
        label: 'Revenue',
        format: 'currency',
        value: null,
        deltaPct: null,
        availability: 'error',
        note: "Revenue couldn't load. The rest of the dashboard is up to date.",
      }
      revenueSeries = {
        availability: 'error',
        granularity,
        points: [],
        note: "Revenue couldn't load. The rest of the dashboard is up to date.",
      }
    }
  }

  // ── Courses ────────────────────────────────────────────────────────────
  const courseWhere = and(isNull(courses.deletedAt), eq(courses.organizationId, organizationId))
  const [coursesTotalRows, createdCurrentRows, createdPreviousRows] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(courses)
      .where(courseWhere),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(courses)
      .where(and(courseWhere, gte(courses.createdAt, range.from), lt(courses.createdAt, range.to))),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(courses)
      .where(
        and(
          courseWhere,
          gte(courses.createdAt, range.prevFrom),
          lt(courses.createdAt, range.prevTo),
        ),
      ),
  ])
  const totalCourses = coursesTotalRows.at(0)?.count ?? 0
  const createdCurrent = createdCurrentRows.at(0)?.count ?? 0
  const createdPrevious = createdPreviousRows.at(0)?.count ?? 0
  const coursesKpi: KpiMetric = {
    id: 'courses',
    label: 'Courses',
    format: 'integer',
    value: totalCourses,
    deltaPct: comparisonDelta({
      current: createdCurrent,
      previous: createdPrevious,
      previousSample: createdPrevious,
    }),
    availability: totalCourses > 0 ? 'ok' : 'no_data',
    comparisonSample: createdPrevious,
    note: 'Change counts courses created in each period.',
  }

  // ── Students ───────────────────────────────────────────────────────────
  const studentWhere = and(
    isNull(enrollments.deletedAt),
    isNull(courses.deletedAt),
    eq(courses.organizationId, organizationId),
  )
  const [studentsTotalRows, studentsCurrentRows, studentsPreviousRows] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(DISTINCT ${enrollments.studentId})::int` })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(studentWhere),
    db
      .select({ count: sql<number>`COUNT(DISTINCT ${enrollments.studentId})::int` })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(
        and(
          studentWhere,
          gte(enrollments.createdAt, range.from),
          lt(enrollments.createdAt, range.to),
        ),
      ),
    db
      .select({ count: sql<number>`COUNT(DISTINCT ${enrollments.studentId})::int` })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(
        and(
          studentWhere,
          gte(enrollments.createdAt, range.prevFrom),
          lt(enrollments.createdAt, range.prevTo),
        ),
      ),
  ])
  const totalStudents = studentsTotalRows.at(0)?.count ?? 0
  const newCurrent = studentsCurrentRows.at(0)?.count ?? 0
  const newPrevious = studentsPreviousRows.at(0)?.count ?? 0
  const studentsKpi: KpiMetric = {
    id: 'students',
    label: 'Students',
    format: 'integer',
    value: totalStudents,
    deltaPct: comparisonDelta({
      current: newCurrent,
      previous: newPrevious,
      previousSample: newPrevious,
    }),
    availability: totalStudents > 0 ? 'ok' : 'no_data',
    comparisonSample: newPrevious,
    note: 'Change counts learners who enrolled in each period.',
  }

  // ── Avg rating ─────────────────────────────────────────────────────────
  const ratingRows = await db
    .select({
      avg: sql<string | null>`AVG(${courseStats.averageRating})`,
      ratings: sql<number>`COALESCE(SUM(${courseStats.ratingCount}), 0)::int`,
    })
    .from(courseStats)
    .innerJoin(courses, eq(courseStats.courseId, courses.id))
    .where(courseWhere)
  const avgRatingRaw = ratingRows.at(0)?.avg
  const avgRating = avgRatingRaw != null ? Number(avgRatingRaw) : null
  const ratingCount = ratingRows.at(0)?.ratings ?? 0
  const avgRatingKpi: KpiMetric = {
    id: 'avgRating',
    label: 'Avg Rating',
    format: 'rating',
    value: avgRating,
    deltaPct: null,
    availability: avgRating == null ? 'no_data' : 'ok',
    comparisonSample: ratingCount,
    note: 'Rating history is not kept per period, so there is no comparison to show.',
  }

  const enrollmentSeriesResult = await enrollmentSeries(organizationId, range, granularity)

  const kpis = [revenueKpi, coursesKpi, studentsKpi, avgRatingKpi]
  const hasHistory = totalCourses > 0 || totalStudents > 0 || avgRating != null
  const isEmpty =
    kpis.every((kpi) => kpi.availability !== 'ok') &&
    revenueSeries.availability !== 'ok' &&
    enrollmentSeriesResult.availability !== 'ok'

  return {
    range: toRangeInfo(range),
    isEmpty,
    hasHistory,
    kpis,
    revenueTrend: revenueSeries,
    enrollmentTrend: enrollmentSeriesResult,
  }
}
