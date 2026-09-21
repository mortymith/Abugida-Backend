import { z } from 'zod'

export const DATE_RANGE_PRESETS = ['7d', '30d', '90d', '12mo'] as const
export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number]

const PRESET_LENGTHS: Record<DateRangePreset, { days?: number; months?: number }> = {
  '7d': { days: 7 },
  '30d': { days: 30 },
  '90d': { days: 90 },
  '12mo': { months: 12 },
}

/** Search-param / server-fn input for the dashboard date range. */
export const dateRangeInputSchema = z
  .object({
    preset: z.enum(DATE_RANGE_PRESETS).optional(),
    /** Custom range, ISO date (yyyy-mm-dd) — takes precedence over preset. */
    from: z.string().optional(),
    to: z.string().optional(),
  })
  .default({})

export type DateRangeInput = {
  preset?: DateRangePreset
  from?: string
  to?: string
}

export interface DateRange {
  /** Inclusive start of the selected period (UTC instant). */
  from: Date
  /** Exclusive end of the selected period (UTC instant). */
  to: Date
  /** Inclusive start of the immediately preceding, equal-length period. */
  prevFrom: Date
  /** Exclusive end of the previous period. */
  prevTo: Date
  /** Human label, e.g. "Last 30 days" or "Jan 1 – Jan 31". */
  label: string
}

export type TrendGranularity = 'day' | 'week' | 'month'

/** Coarser buckets for longer ranges keep the trend charts readable. */
export function resolveTrendGranularity(range: DateRange): TrendGranularity {
  const spanDays = (range.to.getTime() - range.from.getTime()) / 86_400_000
  if (spanDays <= 31) return 'day'
  if (spanDays <= 120) return 'week'
  return 'month'
}

function startOfDayUTC(date: Date): Date {
  const next = new Date(date)
  next.setUTCHours(0, 0, 0, 0)
  return next
}

function formatLabel(from: Date, to: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
  return `${formatter.format(from)} – ${formatter.format(to)}`
}

const PRESET_LABELS: Record<DateRangePreset, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '12mo': 'Last 12 months',
}

/**
 * Resolve a validated date-range input into concrete UTC instants.
 *
 * - Preset: ends "now", spans N days / months back.
 * - Custom (`from` + `to`): inclusive calendar days, in UTC; falls back to the
 *   default preset when missing, inverted, or unparseable.
 * - The previous period is always the immediately preceding equal-length span
 *   so deltas compare like with like.
 */
export function resolveDateRange(
  input: DateRangeInput | undefined,
  now: Date = new Date(),
): DateRange {
  const safeInput: DateRangeInput = input ?? {}
  const customFrom = safeInput.from ? new Date(`${safeInput.from}T00:00:00Z`) : null
  const customTo = safeInput.to ? new Date(`${safeInput.to}T00:00:00Z`) : null

  if (
    customFrom &&
    customTo &&
    !Number.isNaN(customFrom.getTime()) &&
    !Number.isNaN(customTo.getTime()) &&
    customFrom.getTime() <= customTo.getTime()
  ) {
    const from = startOfDayUTC(customFrom)
    const to = new Date(endOfDayUTC(customTo).getTime() + 1)
    const span = to.getTime() - from.getTime()
    return {
      from,
      to,
      prevFrom: new Date(from.getTime() - span),
      prevTo: from,
      label: formatLabel(from, new Date(to.getTime() - 1)),
    }
  }

  const preset: DateRangePreset = safeInput.preset ?? '30d'
  const length = PRESET_LENGTHS[preset]
  const to = now
  const from = length.months
    ? new Date(to)
    : new Date(to.getTime() - (length.days ?? 30) * 86_400_000)
  if (length.months) from.setUTCMonth(from.getUTCMonth() - length.months)
  const span = to.getTime() - from.getTime()

  return {
    from,
    to,
    prevFrom: new Date(to.getTime() - 2 * span),
    prevTo: new Date(to.getTime() - span),
    label: PRESET_LABELS[preset],
  }
}

function endOfDayUTC(date: Date): Date {
  const next = new Date(date)
  next.setUTCHours(23, 59, 59, 999)
  return next
}

export function formatTrendBucket(iso: string, granularity: TrendGranularity): string {
  const date = new Date(iso)
  if (granularity === 'month') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC',
    }).format(date)
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}
