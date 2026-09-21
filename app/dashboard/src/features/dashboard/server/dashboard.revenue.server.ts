import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, gte, isNull, lt, sql } from '@abugida/database'
import { dateRangeInputSchema, resolveDateRange } from '../schemas/dashboard.date-range.schema'
import type {
  KpiMetric,
  RevenueAnalytics,
  RevenueByCourseRow,
  RevenueByGatewayRow,
} from '../dashboard.types'
import { REVENUE_ROLES } from '#/features/auth'
import type { PlatformRole } from '#/features/auth'

function pctDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previous === 0) return current > 0 ? null : 0
  return ((current - previous) / Math.abs(previous)) * 100
}

const REVENUE_NOTE = 'Subscriptions and refunds are not supported by the payment layer yet.'

export const getRevenueAnalytics = createServerFn({ method: 'GET' })
  .validator((input: unknown) => dateRangeInputSchema.parse(input))
  .handler(async ({ data }): Promise<RevenueAnalytics> => {
    const [
      { db },
      { getRequest },
      { auth },
      { resolvePlatformRole },
      { purchases },
      { paymentGateways },
      { courses },
    ] = await Promise.all([
      import('#/config/db.config'),
      import('@tanstack/react-start/server'),
      import('#/config/auth.server'),
      import('#/features/auth/server/auth.roles.server'),
      import('@abugida/database/finance'),
      import('@abugida/database/finance'),
      import('@abugida/database/catalog'),
    ])

    // Hard re-check at the data boundary (defense in depth — the route gate
    // is not the security boundary).
    const request = getRequest()
    const session = await auth.getSession(request.headers)
    const role: PlatformRole = session.ok
      ? await resolvePlatformRole(session.value.user.id)
      : 'viewer'
    if (!REVENUE_ROLES.includes(role)) {
      throw new Error('FORBIDDEN: revenue analytics requires the admin or editor role')
    }

    const range = resolveDateRange(data)
    const completedInRange = and(
      eq(purchases.status, 'completed'),
      isNull(purchases.deletedAt),
      gte(purchases.completedAt, range.from),
      lt(purchases.completedAt, range.to),
    )

    // ── Summary cards ─────────────────────────────────────────────────────
    const currentTotalRows = await db
      .select({
        total: sql<string>`COALESCE(SUM(${purchases.amount}), 0)`,
        transactions: sql<number>`COUNT(*)::int`,
      })
      .from(purchases)
      .where(completedInRange)

    const previousTotalRows = await db
      .select({
        total: sql<string>`COALESCE(SUM(${purchases.amount}), 0)`,
      })
      .from(purchases)
      .where(
        and(
          eq(purchases.status, 'completed'),
          isNull(purchases.deletedAt),
          gte(purchases.completedAt, range.prevFrom),
          lt(purchases.completedAt, range.prevTo),
        ),
      )

    const total = Number(currentTotalRows.at(0)?.total ?? 0)
    const previousTotal = Number(previousTotalRows.at(0)?.total ?? 0)

    const summary: KpiMetric[] = [
      {
        id: 'total',
        label: 'Total Revenue',
        format: 'currency',
        value: total,
        deltaPct: pctDelta(total, previousTotal),
        availability: total > 0 ? 'ok' : 'no_data',
      },
      {
        id: 'oneTime',
        label: 'One-Time',
        format: 'currency',
        value: total,
        deltaPct: pctDelta(total, previousTotal),
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

    // ── Revenue by course (top 5) ─────────────────────────────────────────
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
      .limit(5)

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

    const isEmpty = total === 0 && byCourse.length === 0 && byGateway.length === 0

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString(), label: range.label },
      isEmpty,
      summary,
      byCourse,
      byGateway,
      split: {
        oneTimePct: total > 0 ? 100 : null,
        subscriptionPct: null,
        availability: total > 0 ? 'ok' : 'no_data',
        note: 'All completed purchases are one-time. The split becomes meaningful once subscriptions launch.',
      },
    }
  })
