/**
 * Student-timezone streak logic (spec 06 § S-4.3, S-4.7 Rev 3).
 *
 * The spec: "N consecutive calendar days with any lesson activity,
 * measured in the student's own timezone, not the workspace's. A day
 * counts on any activity ≥ 1 minute; a day with no activity breaks the
 * streak, it does not pause it. Midnight is the student's midnight, so a
 * student in Addis and one in Los Angeles are not penalised differently
 * for the same UTC instant."
 *
 * The existing `students.streak.ts` is UTC-day based; this module wraps
 * it with timezone-aware day-key computation. The streak math itself
 * (consecutive-day counting) is unchanged — only the day boundaries
 * differ.
 */

/**
 * Normalize ISO timestamps into a sorted list of unique day keys in the
 * student's timezone. A day key is `YYYY-MM-DD` in the student's
 * timezone, so a student in `Africa/Addis_Ababa` (UTC+3) whose activity
 * at 22:00 UTC (01:00 the next day Addis time) counts as the next day.
 */
export function toTimezoneDayKeys(
  timestamps: ReadonlyArray<string | Date>,
  timezone: string,
): string[] {
  const keys = new Set<string>()
  for (const value of timestamps) {
    const date = typeof value === 'string' ? new Date(value) : value
    if (Number.isNaN(date.getTime())) continue
    keys.add(timezoneDayKey(date, timezone))
  }
  return Array.from(keys).sort()
}

/**
 * Compute the day key (`YYYY-MM-DD`) for a timestamp in the given
 * timezone. Uses `Intl.DateTimeFormat` with `timeZone` for correct
 * timezone-aware formatting, including DST handling.
 */
export function timezoneDayKey(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date)
}

/**
 * Today's day key in the given timezone.
 */
export function todayKey(timezone: string, now: Date = new Date()): string {
  return timezoneDayKey(now, timezone)
}

/**
 * Compute current + longest streak in the student's timezone. Wraps the
 * existing `computeStreaks` from `students.streak.ts` with timezone-aware
 * day keys.
 */
export function computeTimezoneStreaks(
  activityTimestamps: ReadonlyArray<string | Date>,
  timezone: string,
  now: Date = new Date(),
): { current: number; longest: number } {
  // We can't import from students.streak.ts here without a circular dep
  // in some test setups, so we inline the streak math. The logic is
  // identical to `computeStreaks` in students.streak.ts — only the day
  // keys differ (timezone-aware vs UTC).
  const dayKeys = toTimezoneDayKeys(activityTimestamps, timezone)
  if (dayKeys.length === 0) return { current: 0, longest: 0 }

  const today = todayKey(timezone, now)

  let longest = 1
  let run = 1
  for (let i = 1; i < dayKeys.length; i++) {
    const previous = dayKeys[i - 1]
    const current = dayKeys[i]
    if (diffDays(previous, current) === 1) {
      run += 1
    } else {
      longest = Math.max(longest, run)
      run = 1
    }
  }
  longest = Math.max(longest, run)

  const last = dayKeys[dayKeys.length - 1]
  const gapToToday = diffDays(last, today)
  if (gapToToday > 1) return { current: 0, longest }

  let current = 1
  for (let i = dayKeys.length - 1; i > 0; i--) {
    const later = dayKeys[i]
    const earlier = dayKeys[i - 1]
    if (diffDays(earlier, later) === 1) {
      current += 1
    } else {
      break
    }
  }
  return { current, longest }
}

function diffDays(fromDay: string, toDay: string): number {
  const from = Date.parse(`${fromDay}T00:00:00.000Z`)
  const to = Date.parse(`${toDay}T00:00:00.000Z`)
  return Math.round((to - from) / 86_400_000)
}

/**
 * At-risk flag in the student's timezone. The spec: "No activity for 18
 * days" (14+ days threshold).
 */
export const AT_RISK_INACTIVITY_DAYS = 14

export function isAtRiskInTimezone(
  lastActivityAt: string | null | undefined,
  timezone: string,
  now: Date = new Date(),
): boolean {
  if (!lastActivityAt) return true
  const last = new Date(lastActivityAt)
  if (Number.isNaN(last.getTime())) return true
  const lastDay = timezoneDayKey(last, timezone)
  const today = todayKey(timezone, now)
  return diffDays(lastDay, today) >= AT_RISK_INACTIVITY_DAYS
}

/**
 * The at-risk pill label. The spec: "No activity for 18 days."
 */
export function atRiskLabel(
  lastActivityAt: string | null | undefined,
  timezone: string,
  now: Date = new Date(),
): string | null {
  if (!lastActivityAt) return null
  const last = new Date(lastActivityAt)
  if (Number.isNaN(last.getTime())) return null
  const lastDay = timezoneDayKey(last, timezone)
  const today = todayKey(timezone, now)
  const daysInactive = diffDays(lastDay, today)
  if (daysInactive < AT_RISK_INACTIVITY_DAYS) return null
  return `No activity for ${daysInactive} day${daysInactive === 1 ? '' : 's'}.`
}

/**
 * The streak helper text for the badge editor. The spec: "7 consecutive
 * days with any lesson activity, measured in the student's own timezone."
 */
export const STREAK_HELPER_TEXT =
  "7 consecutive days with any lesson activity, measured in the student's own timezone"
