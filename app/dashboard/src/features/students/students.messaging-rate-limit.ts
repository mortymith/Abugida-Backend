/**
 * Broadcast rate limiting (spec 06 § S-4.5).
 *
 * The spec: "3 broadcasts per cohort (or per audience) per day, and 20
 * messages per day to a single student. Exceeding it is disabled-with-a-
 * reason, not failed after the fact. The limit is per audience, not per
 * Admin, so two staff members cannot collectively bypass it."
 */

export const MAX_BROADCASTS_PER_AUDIENCE_PER_DAY = 3
export const MAX_MESSAGES_PER_STUDENT_PER_DAY = 20

export interface RateLimitState {
  readonly audienceBroadcastsToday: number
  readonly studentMessagesToday: number
}

export type RateLimitResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string; readonly resetAt: number }

/**
 * Check the broadcast rate limit for an audience. The spec: "3 broadcasts
 * per cohort (or per audience) per day." Per-audience, not per-Admin.
 */
export function checkBroadcastRateLimit(state: RateLimitState, now: number): RateLimitResult {
  if (state.audienceBroadcastsToday >= MAX_BROADCASTS_PER_AUDIENCE_PER_DAY) {
    const resetAt = nextDayBoundary(now)
    return {
      allowed: false,
      reason: `You've sent ${MAX_BROADCASTS_PER_AUDIENCE_PER_DAY} broadcasts to this cohort today. Try again tomorrow.`,
      resetAt,
    }
  }
  return { allowed: true }
}

/**
 * Check the per-student message rate limit. The spec: "20 messages per
 * day to a single student."
 */
export function checkStudentRateLimit(state: RateLimitState, now: number): RateLimitResult {
  if (state.studentMessagesToday >= MAX_MESSAGES_PER_STUDENT_PER_DAY) {
    const resetAt = nextDayBoundary(now)
    return {
      allowed: false,
      reason: `You've sent ${MAX_MESSAGES_PER_STUDENT_PER_DAY} messages to this student today. Try again tomorrow.`,
      resetAt,
    }
  }
  return { allowed: true }
}

/**
 * Check both rate limits. The broadcast limit applies to the audience;
 * the student limit applies to each recipient in the broadcast.
 */
export function checkAllRateLimits(state: RateLimitState, now: number): RateLimitResult {
  const broadcastCheck = checkBroadcastRateLimit(state, now)
  if (!broadcastCheck.allowed) return broadcastCheck
  return checkStudentRateLimit(state, now)
}

/**
 * Whether the Send control should be disabled. The spec: "disabled with
 * the reason in a tooltip and in `aria-describedby`, and the reset time
 * is stated."
 */
export function shouldDisableSend(
  state: RateLimitState,
  now: number,
): {
  disabled: boolean
  reason: string | null
  resetAt: number | null
} {
  const result = checkAllRateLimits(state, now)
  if (result.allowed) {
    return { disabled: false, reason: null, resetAt: null }
  }
  return { disabled: true, reason: result.reason, resetAt: result.resetAt }
}

/**
 * Compute the next day boundary (midnight EAT) after `now`. Used for the
 * "Try again tomorrow" reset time.
 */
function nextDayBoundary(now: number): number {
  const date = new Date(now)
  date.setHours(24, 0, 0, 0) // next midnight local time
  return date.getTime()
}

/**
 * The rate-limit label for the Send control's `aria-describedby`.
 */
export function rateLimitLabel(state: RateLimitState, now: number): string {
  const { disabled, reason } = shouldDisableSend(state, now)
  if (!disabled || !reason) return ''
  return reason
}
