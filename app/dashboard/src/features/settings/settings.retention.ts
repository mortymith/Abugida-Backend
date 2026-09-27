/**
 * Pure retention math for S-6.10 (spec 08). A student "matches" an inactivity
 * policy when their most recent activity (login or enrollment access) is
 * older than the inactivity threshold. Activity source: users.last_login_at
 * and the MAX(enrollments.last_accessed_at) the caller resolved — the pure
 * predicate takes both as inputs so the SQL layer stays a thin fetch.
 */

export interface StudentActivityRecord {
  userId: string
  lastLoginAt: Date | null
  /** MAX(enrollments.last_accessed_at) across the student's enrollments. */
  lastEnrollmentActivityAt: Date | null
}

/** Most recent of the two activity sources; null when the student never acted. */
export function lastActiveAt(record: StudentActivityRecord): Date | null {
  const candidates = [record.lastLoginAt, record.lastEnrollmentActivityAt].filter(
    (value): value is Date => value != null,
  )
  if (candidates.length === 0) return null
  return new Date(Math.max(...candidates.map((date) => date.getTime())))
}

/** Cutoff instant: students last active strictly before this date match. */
export function inactivityCutoff(now: Date, inactivityMonths: number): Date {
  const cutoff = new Date(now.getTime())
  cutoff.setUTCMonth(cutoff.getUTCMonth() - inactivityMonths)
  return cutoff
}

export function matchesInactivity(record: StudentActivityRecord, cutoff: Date): boolean {
  const last = lastActiveAt(record)
  // Never-active students match immediately: inactivity is exactly their state.
  return last == null || last.getTime() < cutoff.getTime()
}

/**
 * Warning recipients (spec: "Warning email: [14 days] before action"): a
 * student who does not yet match the full threshold but will cross it within
 * `warningEmailDays` — exactly the cohort the warning email targets at the
 * next run. Their last activity falls in (cutoff, cutoff + warningDays].
 */
export function inWarningWindow(
  record: StudentActivityRecord,
  cutoff: Date,
  warningEmailDays: number,
): boolean {
  if (matchesInactivity(record, cutoff)) return false
  const last = lastActiveAt(record)
  if (last == null) return false
  const warningEndMs = cutoff.getTime() + warningEmailDays * 24 * 60 * 60 * 1000
  return last.getTime() <= warningEndMs
}
