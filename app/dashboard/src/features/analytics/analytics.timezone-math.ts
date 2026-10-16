/**
 * Timezone-aware date math for analytics (spec 07 § Metric Definitions).
 *
 * The spec mandates `Africa/Addis_Ababa` for every metric window. The
 * existing `analytics.metric-math.ts` uses UTC (`startOfDayUTC`,
 * `getUTCDay`) with a comment claiming "spec 11 has no TZ override" —
 * this contradicts the spec 07 Metric Dictionary.
 *
 * This module provides timezone-aware replacements using
 * `Intl.DateTimeFormat` with `timeZone` for correct DST handling. A
 * student in Addis and one in Los Angeles are not penalised differently
 * for the same UTC instant.
 */

import { ANALYTICS_TIMEZONE } from './analytics.metric-dictionary'

/**
 * Format a date as a day key (`YYYY-MM-DD`) in the analytics timezone.
 * Uses `en-CA` locale (which outputs ISO-order dates) with the `timeZone`
 * option for correct timezone-aware formatting.
 */
export function dayKeyInTz(date: Date, timezone: string = ANALYTICS_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * Get the ISO weekday (1=Monday, 7=Sunday) for a date in the analytics
 * timezone. Used by `buildWeekdayActivity` so activity is binned by the
 * student's local weekday, not the UTC weekday.
 */
export function weekdayInTz(date: Date, timezone: string = ANALYTICS_TIMEZONE): number {
  // Intl doesn't expose ISO weekday directly; use `weekday: 'short'` and
  // map. Alternatively, format the date in-tz then parse the weekday.
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  })
  const weekdayName = formatter.format(date)
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  }
  return map[weekdayName] ?? 1
}

/**
 * Convert a Date to the start-of-day (00:00:00.000) in the analytics
 * timezone, returned as a UTC Date. This is the correct way to compute
 * day boundaries for date-range queries: the window is "in EAT", so the
 * boundary is EAT midnight, not UTC midnight.
 *
 * Example: `2026-01-15T22:00:00Z` is `2026-01-16T00:00:00` in Addis
 * (UTC+3). The start of that EAT day is `2026-01-15T21:00:00Z`.
 */
export function startOfDayInTz(date: Date, timezone: string = ANALYTICS_TIMEZONE): Date {
  const key = dayKeyInTz(date, timezone)
  // Parse the day key as a UTC midnight, then apply the timezone offset.
  // For UTC+3 (Addis), the EAT midnight is 3 hours before UTC midnight.
  const utcMidnight = new Date(`${key}T00:00:00.000Z`)
  const offsetMs = timezoneOffsetMs(date, timezone)
  return new Date(utcMidnight.getTime() - offsetMs)
}

/**
 * Convert a Date to the end-of-day (23:59:59.999) in the analytics
 * timezone, returned as a UTC Date.
 */
export function endOfDayInTz(date: Date, timezone: string = ANALYTICS_TIMEZONE): Date {
  const start = startOfDayInTz(date, timezone)
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)
}

/**
 * Get the UTC offset (in milliseconds) for a timezone at a given date.
 * Handles DST correctly via `Intl.DateTimeFormat`. Returns the offset
 * such that `utcTime + offset = localTime` (so Addis returns +3h =
 * +10800000).
 */
function timezoneOffsetMs(date: Date, timezone: string): number {
  // Use the `long` format trick: format the date in the target tz and in
  // UTC, compare the hour difference. More robust: use the `timeZoneName`
  // and parse. But the simplest robust method is the Date round-trip:
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = dtf.formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
  const asUtc = Date.UTC(
    parseInt(get('year'), 10),
    parseInt(get('month'), 10) - 1,
    parseInt(get('day'), 10),
    parseInt(get('hour'), 10) === 24 ? 0 : parseInt(get('hour'), 10),
    parseInt(get('minute'), 10),
    parseInt(get('second'), 10),
  )
  return asUtc - date.getTime()
}

/**
 * Check whether a timestamp falls within a date range `[start, end)` in
 * the analytics timezone. Half-open: the end is exclusive (spec 11 §
 * Localization & Formatting: "half-open `[start, end)`").
 */
export function isInRange(timestamp: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return timestamp >= rangeStart && timestamp < rangeEnd
}

/**
 * Compute the number of days between two dates in the analytics timezone.
 * Useful for "No activity for 18 days" labels and at-risk computation.
 */
export function daysBetweenInTz(
  earlier: Date,
  later: Date,
  timezone: string = ANALYTICS_TIMEZONE,
): number {
  const earlierKey = dayKeyInTz(earlier, timezone)
  const laterKey = dayKeyInTz(later, timezone)
  const earlierDate = new Date(`${earlierKey}T00:00:00.000Z`)
  const laterDate = new Date(`${laterKey}T00:00:00.000Z`)
  return Math.round((laterDate.getTime() - earlierDate.getTime()) / (24 * 60 * 60 * 1000))
}

/**
 * Bucket a date range into period boundaries (day/week/month) in the
 * analytics timezone. Used by `buildCompletionTrend` so trend buckets
 * align on EAT boundaries, not UTC.
 */
export function bucketEndsInTz(
  rangeStart: Date,
  rangeEnd: Date,
  granularity: 'day' | 'week' | 'month',
  timezone: string = ANALYTICS_TIMEZONE,
): Date[] {
  const buckets: Date[] = []
  const cursor = startOfDayInTz(rangeStart, timezone)
  const end = startOfDayInTz(rangeEnd, timezone)

  while (cursor <= end) {
    buckets.push(new Date(cursor))
    if (granularity === 'day') {
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    } else if (granularity === 'week') {
      cursor.setUTCDate(cursor.getUTCDate() + 7)
    } else {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }
  }
  return buckets
}
