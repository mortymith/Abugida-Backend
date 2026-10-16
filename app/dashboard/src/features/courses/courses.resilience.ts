/**
 * Spec 11 § Resilience States: courses resilience resolver.
 * 9-state machine mirroring the marketing/settings/students/analytics pattern.
 */

export const COURSES_RESILIENCE_STATES = [
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

export type CoursesResilienceState = (typeof COURSES_RESILIENCE_STATES)[number]

export interface CoursesResilienceConditions {
  readonly httpStatus: number | null
  readonly isOffline: boolean
  readonly wasOffline: boolean
  readonly sessionExpired: boolean
  readonly conflictDetected: boolean
  readonly partialFailure: boolean
}

export function resolveCoursesResilienceState(
  c: CoursesResilienceConditions,
): CoursesResilienceState {
  if (c.sessionExpired) return 'session_expired'
  if (c.isOffline) return 'offline'
  if (c.httpStatus === 403) return 'forbidden'
  if (c.httpStatus === 404) return 'not_found'
  if (c.conflictDetected) return 'conflict'
  if (c.partialFailure) return 'partial_failure'
  if (c.httpStatus !== null && c.httpStatus >= 500) return 'server_error'
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (c.wasOffline && !c.isOffline) return 'reconnected'
  return 'ok'
}

export interface WorkspaceConditions extends CoursesResilienceConditions {
  readonly itemEditorOpen: boolean
  readonly unsavedChanges: boolean
}

export function resolveWorkspaceResilience(c: WorkspaceConditions): CoursesResilienceState {
  if (c.sessionExpired && c.itemEditorOpen && c.unsavedChanges) return 'session_expired'
  return resolveCoursesResilienceState(c)
}

export type CoursesRetryStrategy = 'none' | 'auto' | 'manual'

export function coursesRetryStrategy(state: CoursesResilienceState): CoursesRetryStrategy {
  if (state === 'offline' || state === 'server_error') return 'auto'
  if (state === 'partial_failure' || state === 'conflict') return 'manual'
  return 'none'
}

export function coursesBackoffDelayMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 16_000)
}
