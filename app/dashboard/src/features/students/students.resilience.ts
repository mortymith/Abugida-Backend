/**
 * Students resilience helpers (spec 06 § Resilience, spec 11 § Resilience
 * States).
 *
 * Every students screen ships 8 resilience states. This module owns the
 * per-screen resolvers that map students-specific conditions to the
 * universal resilience state machine.
 */

export const STUDENTS_RESILIENCE_STATES = [
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

export type StudentsResilienceState = (typeof STUDENTS_RESILIENCE_STATES)[number]

export interface StudentsResilienceConditions {
  readonly httpStatus: number | null
  readonly isOffline: boolean
  readonly wasOffline: boolean
  readonly sessionExpired: boolean
  readonly conflictDetected: boolean
  readonly partialFailure: boolean
  readonly hasData: boolean
}

/**
 * Resolve the resilience state from conditions. Priority order:
 * session_expired > offline > forbidden > not_found > conflict >
 * partial_failure > server_error > reconnected > ok.
 */
export function resolveStudentsResilienceState(
  conditions: StudentsResilienceConditions,
): StudentsResilienceState {
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

// ── Per-screen resolvers ───────────────────────────────────────────────────

export interface MessagingConditions extends StudentsResilienceConditions {
  readonly hasUnsentDraft: boolean
  readonly pendingSendCount: number
}

/**
 * S-4.5 Messaging Center resolver. The messaging screen has special
 * handling: a half-typed draft is preserved across offline/reconnect/
 * session-expiry. Session expiry names the unsent draft specifically.
 */
export function resolveMessagingResilience(
  conditions: MessagingConditions,
): StudentsResilienceState {
  if (conditions.sessionExpired && conditions.hasUnsentDraft) return 'session_expired'
  return resolveStudentsResilienceState(conditions)
}

export interface RequestsConditions extends StudentsResilienceConditions {
  readonly denyDialogOpen: boolean
}

/**
 * S-4.6 Enrollment Requests resolver. The deny dialog has an unsent
 * reason that must survive session expiry.
 */
export function resolveRequestsResilience(conditions: RequestsConditions): StudentsResilienceState {
  if (conditions.sessionExpired && conditions.denyDialogOpen) return 'session_expired'
  return resolveStudentsResilienceState(conditions)
}

export interface RulesConditions extends StudentsResilienceConditions {
  readonly sweepInFlight: boolean
  readonly ruleBuilderOpen: boolean
}

/**
 * S-4.8 Rules resolver. A rule builder with unsaved config and an
 * in-flight sweep both need to survive session expiry.
 */
export function resolveRulesResilience(conditions: RulesConditions): StudentsResilienceState {
  if (conditions.sessionExpired && (conditions.ruleBuilderOpen || conditions.sweepInFlight)) {
    return 'session_expired'
  }
  return resolveStudentsResilienceState(conditions)
}

// ── Retry strategy ─────────────────────────────────────────────────────────

export type StudentsRetryStrategy = 'none' | 'auto' | 'manual'

export function studentsRetryStrategy(state: StudentsResilienceState): StudentsRetryStrategy {
  if (state === 'offline') return 'auto'
  if (state === 'server_error') return 'auto'
  if (state === 'partial_failure') return 'manual'
  if (state === 'conflict') return 'manual'
  return 'none'
}

export function studentsBackoffDelayMs(attempt: number): number {
  const base = 1000
  const max = 16_000
  return Math.min(base * 2 ** attempt, max)
}
