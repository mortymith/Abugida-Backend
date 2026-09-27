/**
 * Pure streak math for S-4.3 (spec 06). Platform policy (S-4.7): "a streak
 * day is a day with any lesson activity". All math is UTC-day based and
 * side-effect free so it is directly unit-testable.
 */

/** Normalize ISO timestamps into a sorted list of unique UTC day keys. */
export function toUtcDayKeys(timestamps: Array<string | Date>): string[] {
  const keys = new Set<string>()
  for (const value of timestamps) {
    const date = typeof value === 'string' ? new Date(value) : value
    if (Number.isNaN(date.getTime())) continue
    keys.add(date.toISOString().slice(0, 10))
  }
  return Array.from(keys).sort()
}

function diffDays(fromDay: string, toDay: string): number {
  const from = Date.parse(`${fromDay}T00:00:00.000Z`)
  const to = Date.parse(`${toDay}T00:00:00.000Z`)
  return Math.round((to - from) / 86_400_000)
}

/**
 * Compute current + longest streak from sorted UTC day keys. `todayUtc` is a
 * `YYYY-MM-DD` key so callers (and tests) control "now". The current streak
 * stays alive as long as the last activity is today or yesterday.
 */
export function computeStreaks(
  dayKeys: string[],
  todayUtc: string,
): { current: number; longest: number } {
  if (dayKeys.length === 0) return { current: 0, longest: 0 }

  let longest = 1
  let run = 1
  for (let i = 1; i < dayKeys.length; i += 1) {
    // Loop bounds guarantee both indices exist.
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

  const gapToToday = diffDays(last, todayUtc)
  if (gapToToday > 1) return { current: 0, longest }

  // Walk backwards from the last day counting the consecutive tail run.
  let current = 1
  for (let i = dayKeys.length - 1; i > 0; i -= 1) {
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

/** At-risk flag (S-4.3): no activity for 14+ days. */
export const AT_RISK_INACTIVITY_DAYS = 14

export function isAtRisk(lastActivityAt: string | null | undefined, todayUtc: string): boolean {
  if (!lastActivityAt) return true
  const last = new Date(lastActivityAt)
  if (Number.isNaN(last.getTime())) return true
  const lastDay = last.toISOString().slice(0, 10)
  return diffDays(lastDay, todayUtc) >= AT_RISK_INACTIVITY_DAYS
}
