import { SLA_DAYS, SLA_WARNING_DAYS } from './settings.constants'

/**
 * Pure SLA math for S-6.10 Data Requests (spec: 30-day statutory deadline,
 * red badge within the final 5 days). All date math is UTC-anchored so
 * results are reproducible from the underlying timestamps.
 */

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

/** Statutory deadline for a request raised on `requestedAt`. */
export function slaDeadline(requestedAt: Date): Date {
  return addDays(requestedAt, SLA_DAYS)
}

/**
 * Whole days left before the deadline (floor — a request due at 23:59 today
 * still shows "0d left", not "1"). Negative once overdue.
 */
export function slaDaysLeft(requestedAt: Date, now: Date): number {
  const deadline = slaDeadline(requestedAt)
  const diffMs = deadline.getTime() - now.getTime()
  return Math.floor(diffMs / (24 * 60 * 60 * 1000))
}

/** Spec: 🔴 badge when within 5 days of the 30-day deadline (or overdue). */
export function isSlaWarning(requestedAt: Date, now: Date): boolean {
  return slaDaysLeft(requestedAt, now) <= SLA_WARNING_DAYS
}
