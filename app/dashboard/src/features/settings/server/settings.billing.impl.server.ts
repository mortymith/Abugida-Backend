/**
 * Server-only implementation of S-6.6 Billing & Subscription.
 *
 * Usage figures are computed from real platform data (distinct active
 * students, active enrollments as seats). The workspace's own subscription
 * plan, invoices, and payment method have no data source in this platform —
 * that state lives with an external billing provider — so those sections are
 * reported with an explicit 'unsupported' availability instead of fabricated
 * rows (the spec 07 precedent for honest unavailability). Never import from
 * client code.
 */
import { and, eq, isNull, sql } from '@abugida/database'
import { enrollments } from '@abugida/database/learning'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import { readConfigKeys, requireSettingsAdmin } from './settings.server-helpers.server'
import type { BillingPage, BillingUsage } from '../settings.types'

/** Usage limit keys (optional; unset limits render usage without a cap). */
const LIMIT_KEYS = ['billing.student_limit', 'billing.seat_limit'] as const

function notStaff() {
  return sql`NOT EXISTS (SELECT 1 FROM "member" WHERE "member"."user_id" = ${users.id})`
}

export async function getBillingPageImpl(): Promise<BillingPage> {
  await requireSettingsAdmin()

  const [studentRows, seatRows, limitConfig] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(users)
      .where(and(isNull(users.deletedAt), notStaff())),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(enrollments)
      .where(and(isNull(enrollments.deletedAt), eq(enrollments.isCompleted, false))),
    readConfigKeys([...LIMIT_KEYS]),
  ])

  const studentLimitRaw = limitConfig[LIMIT_KEYS[0]]
  const seatLimitRaw = limitConfig[LIMIT_KEYS[1]]

  const usage: BillingUsage = {
    students: {
      used: Number(studentRows.at(0)?.count ?? 0),
      limit: typeof studentLimitRaw === 'number' && studentLimitRaw > 0 ? studentLimitRaw : null,
    },
    seats: {
      used: Number(seatRows.at(0)?.count ?? 0),
      limit: typeof seatLimitRaw === 'number' && seatLimitRaw > 0 ? seatLimitRaw : null,
    },
  }

  const approachingLimit = [usage.students, usage.seats].some(
    ({ used, limit }) => limit != null && limit > 0 && used / limit >= 0.9,
  )

  return {
    usage,
    approachingLimit,
    plan: { availability: 'unsupported' },
    invoices: { availability: 'no_data' },
    paymentMethod: { availability: 'unsupported' },
  }
}
