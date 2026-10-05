/**
 * Server-only implementation of S-1.2 Revenue Analytics (admin/editor only).
 * Never import from client code — pulls in the database client, Better Auth
 * server instance, and drizzle operators.
 *
 * Scope: the active workspace, resolved from the course each purchase belongs
 * to. A role without `finance.view_revenue` is stopped here — before any money
 * is selected — so the figure is absent from the payload, not hidden in the view.
 */
import { and, desc, eq, gte, isNull, lt, sql } from '@abugida/database'
import { purchases, paymentGateways } from '@abugida/database/finance'
import { courses } from '@abugida/database/catalog'
import { db } from '#/config/db.config'
import type { DateRangeInput } from '../schemas/dashboard.date-range.schema'
import type {
  KpiMetric,
  RevenueAnalytics,
  RevenueByCourseRow,
  RevenueByGatewayRow,
  RevenueSlice,
} from '../dashboard.types'
import { comparisonDelta } from '../dashboard.metric-math'
import { REVENUE_ROLES } from '#/features/auth'
import {
  getDashboardRole,
  requireDashboardOrganizationId,
  resolveDashboardRange,
} from './dashboard.server-helpers.server'

const REVENUE_NOTE = 'Subscriptions and refunds are not supported by the payment layer yet.'
const PIECE_LIMIT = 4

function foldSlices(rows: RevenueByGatewayRow[]): RevenueSlice[] {
  const head = rows.slice(0, PIECE_LIMIT)
  const tail = rows.slice(PIECE_LIMIT)
  const slices: RevenueSlice[] = head.map((row) => ({
    id: row.gatewayId,
    label: row.displayName,
    amount: row.amount,
    transactions: row.transactions,
  }))
  if (tail.length > 0) {
    slices.push({
      id: 'other',
      label: 'Other',
      amount: tail.reduce((total, row) => total + row.amount, 0),
      transactions: tail.reduce((total, row) => total + row.transactions, 0),
    })
  }
  return slices
}

export async function loadRevenueAnalytics(data: DateRangeInput): Promise<RevenueAnalytics> {
  // Hard re-check at the data boundary (defense in depth — the route gate is
  // not the security boundary).
  const role = await getDashboardRole()
  if (!REVENUE_ROLES.includes(role)) {
    throw new Error('FORBIDDEN: revenue analytics requires the admin or editor role')
  }
  const organizationId = await requireDashboardOrganizationId()

  // S-1.2 labels its cards against the previous 12 months.
  const range = await resolveDashboardRange(data, { compareMonths: 12 })
  const completedInRange = and(
    eq(purchases.status, 'completed'),
    isNull(purchases.deletedAt),
    eq(courses.organizationId, organizationId),
    isNull(courses.deletedAt),
    gte(purchases.completedAt, range.from),
    lt(purchases.completedAt, range.to),
  )

  // ── Summary cards ─────────────────────────────────────────────────────
  const [currentRows, previousRows] = await Promise.all([
    db
      .select({
        total: sql<string>`COALESCE(SUM(${purchases.amount}), 0)`,
        transactions: sql<number>`COUNT(*)::int`,
      })
      .from(purchases)
      .innerJoin(courses, eq(purchases.courseId, courses.id))
      .where(completedInRange),
    db
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
          gte(purchases.completedAt, range.prevFrom),
          lt(purchases.completedAt, range.prevTo),
        ),
      ),
  ])

  const total = Number(currentRows.at(0)?.total ?? 0)
  const previousTotal = Number(previousRows.at(0)?.total ?? 0)
  const previousTransactions = previousRows.at(0)?.transactions ?? 0
  const delta = comparisonDelta({
    current: total,
    previous: previousTotal,
    previousSample: previousTransactions,
  })

  const summary: KpiMetric[] = [
    {
      id: 'total',
      label: 'Total Revenue',
      format: 'currency',
      value: total,
      deltaPct: delta,
      availability: total > 0 ? 'ok' : 'no_data',
      comparisonSample: previousTransactions,
    },
    {
      id: 'oneTime',
      label: 'One-Time',
      format: 'currency',
      value: total,
      deltaPct: delta,
      availability: total > 0 ? 'ok' : 'no_data',
      note: 'All completed purchases are one-time today.',
    },
    {
      id: 'subscription',
      label: 'Subscription',
      format: 'currency',
      value: null,
      deltaPct: null,
      availability: 'unsupported',
      note: REVENUE_NOTE,
    },
    {
      id: 'refund',
      label: 'Refund',
      format: 'currency',
      value: null,
      deltaPct: null,
      availability: 'unsupported',
      note: REVENUE_NOTE,
    },
  ]

  // ── Revenue by course ─────────────────────────────────────────────────
  const byCourseRows = await db
    .select({
      courseId: sql<string>`(${courses.publicId})::text`,
      title: courses.title,
      amount: sql<string>`COALESCE(SUM(${purchases.amount}), 0)`,
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(completedInRange)
    .groupBy(courses.id, courses.publicId, courses.title)
    .orderBy(desc(sql`COALESCE(SUM(${purchases.amount}), 0)`))
    .limit(8)

  const byCourse: RevenueByCourseRow[] = byCourseRows.map((row) => ({
    courseId: row.courseId,
    title: row.title,
    amount: Number(row.amount),
  }))

  // ── Revenue by payment gateway ────────────────────────────────────────
  const gatewayRows = await db
    .select({
      gatewayId: sql<string>`(${paymentGateways.publicId})::text`,
      displayName: paymentGateways.displayName,
      providerName: sql<string>`${paymentGateways.providerName}::text`,
      transactions: sql<number>`COUNT(*)::int`,
      amount: sql<string>`COALESCE(SUM(${purchases.amount}), 0)`,
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .innerJoin(paymentGateways, eq(purchases.paymentGatewayId, paymentGateways.id))
    .where(completedInRange)
    .groupBy(
      paymentGateways.id,
      paymentGateways.publicId,
      paymentGateways.displayName,
      paymentGateways.providerName,
    )
    .orderBy(desc(sql`COALESCE(SUM(${purchases.amount}), 0)`))

  const byGateway: RevenueByGatewayRow[] = gatewayRows.map((row) => ({
    gatewayId: row.gatewayId,
    displayName: row.displayName,
    providerName: row.providerName,
    transactions: Number(row.transactions),
    amount: Number(row.amount),
  }))

  // ── Has the workspace ever taken a payment? ───────────────────────────
  const historyRows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(
      and(
        eq(purchases.status, 'completed'),
        isNull(purchases.deletedAt),
        eq(courses.organizationId, organizationId),
        isNull(courses.deletedAt),
      ),
    )
  const hasHistory = (historyRows.at(0)?.count ?? 0) > 0

  return {
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      label: range.label,
      comparisonLabel: range.comparisonLabel,
      ...(range.partialDayNote ? { partialDayNote: range.partialDayNote } : {}),
    },
    isEmpty: total === 0 && byCourse.length === 0 && byGateway.length === 0,
    hasHistory,
    summary,
    byCourse,
    byGateway,
    slices: foldSlices(byGateway),
  }
}
