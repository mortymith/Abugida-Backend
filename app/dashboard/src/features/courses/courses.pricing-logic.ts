import type { BillingPeriod } from './schemas/courses.authoring.schema'

/**
 * Pricing math for S-2.4. The finance model has no recurring-billing engine:
 * subscription periods map to `purchase_options.durationDays`
 * (30 / 90 / 365) and one-time purchases get a 100-year access window.
 * Documented in the PR as a deliberate mapping, not a silent workaround.
 */
export const BILLING_PERIOD_DAYS: Record<BillingPeriod, number> = {
  monthly: 30,
  quarterly: 90,
  annual: 365,
}

export const LIFETIME_ACCESS_DAYS = 36_500

export function accessDaysForModel(
  model: 'free' | 'one_time' | 'subscription',
  period: BillingPeriod | undefined,
): number {
  if (model === 'subscription') {
    return BILLING_PERIOD_DAYS[period ?? 'monthly']
  }
  return LIFETIME_ACCESS_DAYS
}

export function accessLabelForModel(
  model: 'free' | 'one_time' | 'subscription',
  period: BillingPeriod | undefined,
): string {
  if (model === 'free') return 'Free'
  if (model === 'one_time') return 'One-time purchase'
  const label: Record<BillingPeriod, string> = {
    monthly: 'Monthly subscription',
    quarterly: 'Quarterly subscription',
    annual: 'Annual subscription',
  }
  return label[period ?? 'monthly']
}

/** Early-bird price at checkout time, or null when no early-bird applies. */
export function applyEarlyBird(
  basePrice: number,
  earlyBird: { percentage: number; endsAt: string | null } | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!earlyBird || !earlyBird.endsAt) return null
  const deadline = new Date(earlyBird.endsAt)
  if (Number.isNaN(deadline.getTime()) || deadline.getTime() < now.getTime()) return null
  return roundCurrency(basePrice * (1 - earlyBird.percentage / 100))
}

export function applyBulkDiscount(
  basePrice: number,
  bulk: { percentage: number; minEnrollments: number | null } | null | undefined,
  enrollmentCount: number,
): number | null {
  if (!bulk) return null
  const minimum = bulk.minEnrollments ?? 0
  if (enrollmentCount < minimum) return null
  return roundCurrency(basePrice * (1 - bulk.percentage / 100))
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

/** Stable product id for purchase_options rows. */
export function buildProductId(slug: string, model: string, period?: BillingPeriod): string {
  const suffix = model === 'subscription' ? (period ?? 'monthly') : 'lifetime'
  return `course-${slug}-${suffix}`.slice(0, 255)
}
