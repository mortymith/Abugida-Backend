/**
 * Review-lock deferral logic (spec 06 § S-4.8).
 *
 * The spec: "A rule whose trigger fires during a course's review lock
 * does not silently mutate a course under review. The run holds the
 * matched students, marks them Deferred — course in review, and queues
 * them for the next sweep once the lock clears. A manual override is
 * available to an Admin with S-7.1 confirmation."
 *
 * Also: "deferred is visibly distinct from failed because deferred
 * students are still going to be enrolled."
 */

export type DeferralReason = 'review_lock' | 'capacity_reached'

export const DEFERRAL_REASON_LABELS: Record<DeferralReason, string> = {
  review_lock: 'course in review',
  capacity_reached: 'capacity reached',
}

export interface DeferralContext {
  readonly targetCourseStatus: string // draft | in_review | approved | published | archived
  readonly targetCourseCapacity: number | null
  readonly currentEnrollmentCount: number
}

export interface DeferralDecision {
  readonly shouldDefer: boolean
  readonly reason: DeferralReason | null
  readonly message: string | null
}

/**
 * Whether a rule's enrollment should be deferred. The spec: a trigger
 * firing during a course's review lock defers the students. Capacity
 * reached also defers (the students are moved to the waitlist, not
 * dropped).
 */
export function shouldDeferEnrollment(ctx: DeferralContext): DeferralDecision {
  // Review lock: course is in_review or approved (not yet published).
  if (ctx.targetCourseStatus === 'in_review' || ctx.targetCourseStatus === 'approved') {
    return {
      shouldDefer: true,
      reason: 'review_lock',
      message: `Deferred — ${DEFERRAL_REASON_LABELS.review_lock}`,
    }
  }
  // Capacity reached: course is full.
  if (ctx.targetCourseCapacity !== null && ctx.currentEnrollmentCount >= ctx.targetCourseCapacity) {
    return {
      shouldDefer: true,
      reason: 'capacity_reached',
      message: `Deferred — ${DEFERRAL_REASON_LABELS.capacity_reached}`,
    }
  }
  return { shouldDefer: false, reason: null, message: null }
}

/**
 * The manual-override confirmation message. The spec: "TOEFL Complete is
 * in review. Enrolling 12 students now publishes them into a course that
 * is not approved. Enqueue instead?"
 */
export function manualOverrideMessage(
  courseName: string,
  studentCount: number,
  reason: DeferralReason,
): string {
  if (reason === 'review_lock') {
    const noun = studentCount === 1 ? 'student' : 'students'
    return `${courseName} is in review. Enrolling ${studentCount} ${noun} now publishes them into a course that is not approved. Enqueue instead?`
  }
  return `${courseName} has reached capacity. Enrolling ${studentCount} students will overfill the course. Enqueue to waitlist instead?`
}

/**
 * Whether a manual override is permitted. Only Admins can override a
 * review-lock deferral (the spec: "A manual override is available to an
 * Admin with S-7.1 confirmation").
 */
export function canOverrideDeferral(role: string): boolean {
  return role === 'admin'
}

/**
 * The run-log partial-failure message. The spec: "Enrolled 31 of 34. 2
 * deferred — TOEFL Complete is in review. 1 failed — capacity reached."
 * Deferred is reported separately from failed.
 */
export interface RunLogSummary {
  readonly matched: number
  readonly enrolled: number
  readonly skipped: number
  readonly deferred: number
  readonly failed: number
  readonly deferralReasons: ReadonlyArray<{ reason: DeferralReason; count: number }>
  readonly failureReasons: ReadonlyArray<{ reason: string; count: number }>
}

export function runLogSummaryMessage(summary: RunLogSummary): string {
  const parts: string[] = [`Enrolled ${summary.enrolled} of ${summary.matched}.`]
  if (summary.deferred > 0) {
    const reasonParts = summary.deferralReasons
      .map((d) => `${d.count} — ${DEFERRAL_REASON_LABELS[d.reason]}`)
      .join('; ')
    parts.push(`${summary.deferred} deferred — ${reasonParts}`)
  }
  if (summary.failed > 0) {
    const reasonParts = summary.failureReasons.map((f) => `${f.count} — ${f.reason}`).join('; ')
    parts.push(`${summary.failed} failed — ${reasonParts}`)
  }
  if (summary.skipped > 0) {
    parts.push(`${summary.skipped} skipped`)
  }
  return parts.join('. ') + '.'
}

/**
 * Whether the "Last sweep" timestamp should be advanced after a run. The
 * spec: "the Last sweep timestamp is not advanced on a failed run, so a
 * stale sweep is visible."
 */
export function shouldAdvanceLastSweep(runSucceeded: boolean): boolean {
  return runSucceeded
}

/**
 * The "Last sweep" label. The spec: "Last sweep: Sep 29, 6:00 PM EAT
 * (Africa/Addis_Ababa) · 34 enrolled".
 */
export function lastSweepLabel(
  lastSweepAt: number | null,
  enrolledCount: number,
  timezone: string,
): string {
  if (lastSweepAt === null) return 'Never run'
  const date = new Date(lastSweepAt)
  const formatted = date.toLocaleString('en-US', {
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return `Last sweep: ${formatted} (${timezone}) · ${enrolledCount} enrolled`
}
