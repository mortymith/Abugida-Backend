/**
 * S-5.1 Period-comparison logic (spec 07 § S-5.1 — Period comparison).
 *
 * The spec: "the vs previous period toggle is always available and
 * defaults on in the unscoped all-courses view, off inside the workspace
 * instance. Comparing a partial window to a full one is allowed but
 * warns explicitly — 'Sep 1–14 compared with Jul 18–31 — different
 * lengths and weekdays; treat this as indicative.' The user can hide the
 * comparison entirely when the periods are not comparable."
 */

export interface DateRange {
  readonly start: Date
  readonly end: Date
}

export interface PeriodComparison {
  readonly current: DateRange
  readonly previous: DateRange
  readonly isPartial: boolean
  readonly warning: string | null
}

/**
 * Compute the previous period for a given range. The previous period has
 * the same length as the current, ending the day before the current
 * starts.
 */
export function computePreviousPeriod(current: DateRange): DateRange {
  const lengthMs = current.end.getTime() - current.start.getTime()
  const dayMs = 24 * 60 * 60 * 1000
  const previousEnd = new Date(current.start.getTime() - dayMs)
  const previousStart = new Date(previousEnd.getTime() - lengthMs)
  return { start: previousStart, end: previousEnd }
}

/**
 * Check whether a period comparison is partial (different lengths or
 * different weekday distributions). The spec: "different lengths and
 * weekdays; treat this as indicative."
 */
export function isPartialWindowComparison(current: DateRange, previous: DateRange): boolean {
  const currentLength = current.end.getTime() - current.start.getTime()
  const previousLength = previous.end.getTime() - previous.start.getTime()
  // Different lengths → partial.
  if (currentLength !== previousLength) return true
  // Same length but different weekday distribution (e.g., 14 days starting
  // on different weekdays) — actually same length + same start weekday is
  // full; same length + different start weekday is partial.
  const currentStartDay = current.start.getDay()
  const previousStartDay = previous.start.getDay()
  return currentStartDay !== previousStartDay
}

/**
 * Build the period-comparison warning message. Returns `null` when the
 * comparison is not partial.
 */
export function partialWindowWarning(current: DateRange, previous: DateRange): string | null {
  if (!isPartialWindowComparison(current, previous)) return null
  const currentLabel = formatRangeLabel(current)
  const previousLabel = formatRangeLabel(previous)
  return `${currentLabel} compared with ${previousLabel} — different lengths and weekdays; treat this as indicative.`
}

/**
 * Format a date range as "Sep 1–14" (spec style).
 */
function formatRangeLabel(range: DateRange): string {
  const startMonth = range.start.toLocaleString('en-US', { month: 'short' })
  const endMonth = range.end.toLocaleString('en-US', { month: 'short' })
  if (startMonth === endMonth) {
    return `${startMonth} ${range.start.getDate()}–${range.end.getDate()}`
  }
  return `${startMonth} ${range.start.getDate()} – ${endMonth} ${range.end.getDate()}`
}

/**
 * Compute the full period comparison: current, previous, partial flag,
 * and warning.
 */
export function computePeriodComparison(current: DateRange): PeriodComparison {
  const previous = computePreviousPeriod(current)
  const isPartial = isPartialWindowComparison(current, previous)
  const warning = isPartial ? partialWindowWarning(current, previous) : null
  return { current, previous, isPartial, warning }
}

/**
 * The delta percentage between two values. Used for KPI cards:
 * "+12% prev 30d" or "−3% prev 30d".
 */
export function computeDelta(current: number, previous: number): { value: number; label: string } {
  if (previous === 0) {
    return { value: 0, label: current > 0 ? '+∞' : '0%' }
  }
  const delta = ((current - previous) / previous) * 100
  const sign = delta > 0 ? '+' : ''
  return { value: Math.round(delta), label: `${sign}${Math.round(delta)}%` }
}
