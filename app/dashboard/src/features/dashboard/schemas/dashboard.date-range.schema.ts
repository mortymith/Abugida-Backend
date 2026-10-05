import { z } from 'zod'

/**
 * S-1.1 / S-1.2 date range contract.
 *
 * One range governs **every** card, chart and table row on the screen — there is
 * no per-card date picker — and it lives in the URL (`?preset=` or `?from=&to=`
 * plus `?compare=`) so a shared link reproduces the view exactly.
 *
 * Two decisions worth stating out loud:
 *
 * - **Day boundaries are `Africa/Addis_Ababa` days, not UTC days.** A preset
 *   that ends "today" has to mean the user's today. Every `from`/`to` instant
 *   below is therefore a midnight-in-Addis instant, expressed in UTC.
 * - **`to` is exclusive.** `[from, to)` with `to` = the start of the day after
 *   the last included day keeps the SQL predicates uniform and makes the
 *   previous-period arithmetic exact.
 */
export const REPORTING_TIME_ZONE = 'Africa/Addis_Ababa'

/** EAT is UTC+3 with no DST, so the offset is a constant, not a rule set. */
const EAT_OFFSET_MINUTES = 3 * 60

export const DATE_RANGE_PRESETS = [
  '7d',
  '30d',
  '90d',
  '12mo',
  'thisMonth',
  'lastMonth',
  'allTime',
] as const
export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number]

export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '12mo': 'Last 12 months',
  thisMonth: 'This month',
  lastMonth: 'Last month',
  allTime: 'All time',
}

const DAY_MS = 86_400_000
/** Custom ranges are capped so a mistyped year cannot pull the whole table. */
export const MAX_CUSTOM_RANGE_MS = 730 * DAY_MS

/** Search-param / server-fn input for the dashboard date range. */
export const dateRangeInputSchema = z
  .object({
    preset: z.enum(DATE_RANGE_PRESETS).optional(),
    /** Custom range, ISO date (yyyy-mm-dd) in the reporting time zone. */
    from: z.string().optional(),
    to: z.string().optional(),
    /** "Compare vs previous period" toggle (S-1.1). Absent means on. */
    compare: z.union([z.boolean(), z.enum(['true', 'false', '1', '0'])]).optional(),
  })
  .default({})

/** Whether the screen compares against the previous period. Defaults to on. */
export function isCompareEnabled(input: Pick<DateRangeInput, 'compare'> | undefined): boolean {
  const value = input?.compare
  if (value === undefined) return true
  return value === true || value === 'true' || value === '1'
}

export type DateRangeInput = {
  preset?: DateRangePreset
  from?: string
  to?: string
  /** `false` / `'false'` turns the comparison off; anything else leaves it on. */
  compare?: boolean | 'true' | 'false' | '1' | '0'
}

export interface DateRange {
  /** Inclusive start of the selected period (UTC instant of an EAT midnight). */
  from: Date
  /** Exclusive end of the selected period (UTC instant of an EAT midnight). */
  to: Date
  /** Inclusive start of the comparison period. */
  prevFrom: Date
  /** Exclusive end of the comparison period — normally the range start. */
  prevTo: Date
  /** Human label, e.g. "Last 30 days" or "Jan 1 – Jan 31". */
  label: string
  /**
   * Named comparison basis, e.g. "previous 30 days". The stat card prints it
   * under the delta and exposes it as a tooltip, so a copied screenshot is
   * self-describing (S-1.1 stat card contract).
   */
  comparisonLabel: string
  /**
   * Set when the range's last day is still in progress — "Sep 29 is still in
   * progress." A partial day is labelled, never silently compared.
   */
  partialDayNote?: string
}

export type TrendGranularity = 'day' | 'week' | 'month'

export interface ResolveRangeOptions {
  /** Earliest date with data, for the `allTime` preset (ISO yyyy-mm-dd). */
  allTimeFrom?: string
  /**
   * Fix the comparison window to N months back instead of the previous
   * equal-length period — S-1.2 labels its cards "vs previous 12 months".
   */
  compareMonths?: number
}

// ── EAT calendar helpers ────────────────────────────────────────────────

interface DayParts {
  year: number
  month: number
  day: number
}

function eatDayParts(instant: Date): DayParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: REPORTING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(
    formatter
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number | undefined>
  return { year: parts.year ?? 0, month: parts.month ?? 1, day: parts.day ?? 1 }
}

/** UTC instant of 00:00 on the Addis day that contains `instant`. */
export function startOfReportingDay(instant: Date): Date {
  const { year, month, day } = eatDayParts(instant)
  return new Date(Date.UTC(year, month - 1, day) - EAT_OFFSET_MINUTES * 60_000)
}

/** Start of the Addis day after `dayStart`. */
export function endOfReportingDay(dayStart: Date): Date {
  return new Date(dayStart.getTime() + DAY_MS)
}

function addDays(dayStart: Date, days: number): Date {
  return new Date(dayStart.getTime() + days * DAY_MS)
}

function addMonths(dayStart: Date, months: number): Date {
  const { year, month, day } = eatDayParts(dayStart)
  const target = new Date(Date.UTC(year, month - 1 + months, day))
  const daysInTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate()
  target.setUTCDate(Math.min(day, daysInTargetMonth))
  return startOfReportingDay(target)
}

function formatDayLabel(dayStart: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: REPORTING_TIME_ZONE,
  }).format(new Date(dayStart.getTime() + EAT_OFFSET_MINUTES * 60_000))
}

function formatRangeLabel(from: Date, to: Date): string {
  return `${formatDayLabel(from)} – ${formatDayLabel(new Date(to.getTime() - DAY_MS))}`
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS))
}

// ── Validation ──────────────────────────────────────────────────────────

export type RangeValidation = { ok: true } | { ok: false; field: 'from' | 'to'; message: string }

/**
 * Custom-range validation (S-1.1): end ≥ start, no future dates, span ≤ 2
 * years. The picker keeps the last valid range applied while showing the message
 * inline, so an invalid entry never blanks the screen.
 */
export function validateCustomRange(
  input: Pick<DateRangeInput, 'from' | 'to'> | undefined,
  now: Date = new Date(),
): RangeValidation {
  const { from, to } = input ?? {}
  if (!from && !to) return { ok: true }
  if (!from || !to) {
    return {
      ok: false,
      field: from ? 'to' : 'from',
      message: 'Enter both a start and an end date.',
    }
  }

  const start = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, field: 'from', message: 'Enter dates as year-month-day.' }
  }
  if (start.getTime() > end.getTime()) {
    return { ok: false, field: 'to', message: 'End date must be on or after the start date.' }
  }

  const today = startOfReportingDay(now)
  // `end` is parsed as a UTC midnight, so compare its **reporting day** with
  // today — otherwise "today" looks like a future date for part of the day.
  if (startOfReportingDay(end).getTime() > today.getTime()) {
    return { ok: false, field: 'to', message: "End date can't be in the future." }
  }
  if (end.getTime() - start.getTime() + DAY_MS > MAX_CUSTOM_RANGE_MS) {
    return { ok: false, field: 'to', message: 'A custom range can span at most 2 years.' }
  }
  return { ok: true }
}

/** True when the input selects a custom range (either endpoint present). */
export function hasCustomRange(input: Pick<DateRangeInput, 'from' | 'to'> | undefined): boolean {
  return Boolean(input?.from || input?.to)
}

/** The custom range is only honoured when it passes validation. */
export function isCustomRangeValid(
  input: Pick<DateRangeInput, 'from' | 'to'> | undefined,
  now: Date = new Date(),
): boolean {
  if (!hasCustomRange(input)) return false
  return validateCustomRange(input, now).ok
}

// ── Resolution ──────────────────────────────────────────────────────────

/** Coarser buckets for longer ranges keep the trend charts readable. */
export function resolveTrendGranularity(range: DateRange): TrendGranularity {
  const spanDays = (range.to.getTime() - range.from.getTime()) / DAY_MS
  if (spanDays <= 45) return 'day'
  if (spanDays <= 120) return 'week'
  return 'month'
}

/**
 * Resolve a validated date-range input into concrete instants.
 *
 * - Custom (`from` + `to`, valid): inclusive Addis calendar days.
 * - Presets: end at the end of the user's current Addis day.
 * - The comparison period is the immediately preceding equal-length span, so a
 *   delta always compares like with like — or the previous N months when the
 *   screen asks for a YoY basis (S-1.2).
 */
export function resolveDateRange(
  input: DateRangeInput | undefined,
  now: Date = new Date(),
  options: ResolveRangeOptions = {},
): DateRange {
  const safeInput: DateRangeInput = input ?? {}
  const today = startOfReportingDay(now)
  const tomorrow = endOfReportingDay(today)

  if (isCustomRangeValid(safeInput, now)) {
    const from = startOfReportingDay(new Date(`${safeInput.from}T12:00:00Z`))
    const to = endOfReportingDay(startOfReportingDay(new Date(`${safeInput.to}T12:00:00Z`)))
    const spanDays = daysBetween(from, to)
    const range: DateRange = {
      from,
      to,
      prevFrom: addDays(from, -spanDays),
      prevTo: from,
      label: formatRangeLabel(from, to),
      comparisonLabel: `previous ${spanDays} days`,
    }
    const note = partialDayNote(range, today)
    return note ? { ...range, partialDayNote: note } : range
  }

  const preset: DateRangePreset = hasCustomRange(safeInput) ? '30d' : (safeInput.preset ?? '30d')
  let from: Date
  let to: Date

  switch (preset) {
    case '7d':
      from = addDays(today, -6)
      to = tomorrow
      break
    case '90d':
      from = addDays(today, -89)
      to = tomorrow
      break
    case '12mo':
      from = addMonths(today, -12)
      to = tomorrow
      break
    case 'thisMonth': {
      const parts = eatDayParts(today)
      from = startOfReportingDay(new Date(Date.UTC(parts.year, parts.month - 1, 1)))
      to = tomorrow
      break
    }
    case 'lastMonth': {
      const parts = eatDayParts(today)
      from = startOfReportingDay(new Date(Date.UTC(parts.year, parts.month - 2, 1)))
      to = startOfReportingDay(new Date(Date.UTC(parts.year, parts.month - 1, 1)))
      break
    }
    case 'allTime': {
      const earliest = options.allTimeFrom
        ? startOfReportingDay(new Date(`${options.allTimeFrom}T12:00:00Z`))
        : today
      from = earliest.getTime() <= today.getTime() ? earliest : today
      to = tomorrow
      break
    }
    case '30d':
    default:
      from = addDays(today, -29)
      to = tomorrow
      break
  }

  const compareMonths = options.compareMonths
  const prevFrom = compareMonths
    ? addMonths(from, -compareMonths)
    : addDays(from, -daysBetween(from, to))
  const spanDays = daysBetween(from, to)
  const comparisonLabel = compareMonths
    ? `previous ${compareMonths} months`
    : `previous ${spanDays} days`

  const range: DateRange = {
    from,
    to,
    prevFrom,
    prevTo: from,
    label: DATE_RANGE_PRESET_LABELS[preset],
    comparisonLabel,
  }
  const note = partialDayNote(range, today)
  return note ? { ...range, partialDayNote: note } : range
}

function partialDayNote(range: DateRange, today: Date): string | undefined {
  const lastDay = new Date(range.to.getTime() - DAY_MS)
  return lastDay.getTime() >= today.getTime()
    ? `${formatDayLabel(lastDay)} is still in progress.`
    : undefined
}

/**
 * Clock time in the reporting zone with the zone spelled out — "4:12 PM EAT".
 * The stale-value label uses it so a cached figure never reads as current
 * without also saying when it was taken and in whose clock.
 */
export function formatReportingTime(instant: Date): string {
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: REPORTING_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(instant)
  return `${time} EAT`
}

export function formatTrendBucket(iso: string, granularity: TrendGranularity): string {
  const instant = new Date(iso)
  const shifted = new Date(instant.getTime() + EAT_OFFSET_MINUTES * 60_000)
  if (granularity === 'month') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC',
    }).format(shifted)
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(shifted)
}
