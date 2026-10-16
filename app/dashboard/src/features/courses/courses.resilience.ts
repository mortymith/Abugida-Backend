/**
 * Resilience state machine (spec 04 § Resilience, spec 11 § Resilience
 * States).
 *
 * Every screen in Part 04 (and Part 11 mandates this for all 76 screens)
 * ships 8 resilience states. This module owns the state machine that
 * decides which state a screen is in, given the underlying conditions
 * (HTTP status, network state, session state, conflict state, partial
 * failure, server error).
 *
 * The 8 states:
 *
 * 1. **`ok`** — the normal state. Data loaded, no errors.
 * 2. **`forbidden` (403)** — the user lacks permission for this surface.
 *    Case 3 of the permission rule: the whole surface is replaced by an
 *    explanation.
 * 3. **`not_found` (404)** — the entity does not exist or was deleted.
 * 4. **`offline`** — the network is down. A persistent banner (not a
 *    toast); reads from cache; queued writes flush in order on reconnect.
 * 5. **`reconnected`** — the network came back. A toast confirms; queued
 *    writes flush.
 * 6. **`session_expired`** — the auth session expired. A 2-minute warning
 *    modal names unsaved surfaces; on return, the same tab/filter/page is
 *    restored.
 * 7. **`conflict`** — a `rowVersion` mismatch. The two-column diff opens
 *    (Keep mine / Take theirs / Compare). Never Reload-only.
 * 8. **`partial_failure`** — a bulk action had mixed results. Per-item
 *    reporting ("47 archived · 3 failed — Retry failures"), never one
 *    toast for a batch.
 * 9. **`server_error` (5xx)** — an unexpected server error. Retry with
 *    exponential backoff.
 *
 * This module is framework-free: it owns the state machine. The React
 * component (`<ResilienceStates/>`) renders the appropriate UI per state.
 */

export const RESILIENCE_STATES = [
  'ok',
  'forbidden',
  'not_found',
  'offline',
  'reconnected',
  'session_expired',
  'conflict',
  'partial_failure',
  'server_error',
] as const

export type ResilienceState = (typeof RESILIENCE_STATES)[number]

export const RESILIENCE_STATE_LABELS: Record<ResilienceState, string> = {
  ok: 'All good',
  forbidden: 'You do not have access to this',
  not_found: 'This could not be found',
  offline: "You're offline",
  reconnected: "You're back online",
  session_expired: 'Your session has expired',
  conflict: 'Someone else edited this',
  partial_failure: 'Some actions did not complete',
  server_error: 'Something went wrong on our end',
}

export interface ResilienceConditions {
  readonly httpStatus: number | null
  readonly isOffline: boolean
  readonly wasOffline: boolean // was offline before the current check
  readonly sessionExpired: boolean
  readonly conflictDetected: boolean
  readonly partialFailure: boolean
  readonly hasData: boolean
}

/**
 * Resolve the resilience state from the underlying conditions. The
 * priority order matters — a higher-priority state masks a lower one.
 *
 * Priority (highest first):
 * 1. `session_expired` — without a session, nothing else matters.
 * 2. `offline` — without a network, server states are stale.
 * 3. `forbidden` (403) — permission is checked before existence.
 * 4. `not_found` (404) — existence is checked before rendering.
 * 5. `conflict` — a conflict blocks the save path.
 * 6. `partial_failure` — a bulk action had mixed results.
 * 7. `server_error` (5xx) — retry with backoff.
 * 8. `reconnected` — transient confirmation after offline.
 * 9. `ok` — the normal state.
 */
export function resolveResilienceState(conditions: ResilienceConditions): ResilienceState {
  if (conditions.sessionExpired) return 'session_expired'
  if (conditions.isOffline) return 'offline'
  if (conditions.httpStatus === 403) return 'forbidden'
  if (conditions.httpStatus === 404) return 'not_found'
  if (conditions.conflictDetected) return 'conflict'
  if (conditions.partialFailure) return 'partial_failure'
  if (conditions.httpStatus !== null && conditions.httpStatus >= 500) return 'server_error'
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (conditions.wasOffline && !conditions.isOffline) return 'reconnected'
  return 'ok'
}

/**
 * Whether the state is recoverable without user action. `offline` and
 * `reconnected` recover automatically; `session_expired` requires a
 * re-login; `conflict` requires a user choice; `partial_failure` requires
 * a Retry click; `server_error` retries with backoff.
 */
export function isAutoRecoverable(state: ResilienceState): boolean {
  return state === 'offline' || state === 'reconnected' || state === 'server_error'
}

/**
 * Whether the state blocks all interaction. `forbidden`, `not_found`, and
 * `session_expired` block the whole surface; the others allow partial
 * interaction (e.g. offline allows reads from cache).
 */
export function blocksAllInteraction(state: ResilienceState): boolean {
  return state === 'forbidden' || state === 'not_found' || state === 'session_expired'
}

/**
 * The retry strategy for the state. `none` = no retry; `auto` = retry
 * with exponential backoff; `manual` = user clicks Retry.
 */
export type RetryStrategy = 'none' | 'auto' | 'manual'

export function retryStrategy(state: ResilienceState): RetryStrategy {
  if (state === 'offline') return 'auto'
  if (state === 'reconnected') return 'none'
  if (state === 'server_error') return 'auto'
  if (state === 'partial_failure') return 'manual'
  if (state === 'conflict') return 'manual'
  return 'none'
}

/**
 * Exponential backoff schedule for auto-retry states. Returns the delay
 * in ms for the given attempt number (0-indexed).
 *
 * - attempt 0: 1s
 * - attempt 1: 2s
 * - attempt 2: 4s
 * - attempt 3: 8s
 * - attempt 4+: 16s (capped)
 */
export function backoffDelayMs(attempt: number): number {
  const base = 1000
  const max = 16_000
  return Math.min(base * 2 ** attempt, max)
}
