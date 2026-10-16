/**
 * Settings resilience helpers (spec 08 § Resilience, spec 11 § Resilience
 * States). Per-screen resolvers for the 11 settings screens.
 */

export const SETTINGS_RESILIENCE_STATES = [
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

export type SettingsResilienceState = (typeof SETTINGS_RESILIENCE_STATES)[number]

export interface SettingsResilienceConditions {
  readonly httpStatus: number | null
  readonly isOffline: boolean
  readonly wasOffline: boolean
  readonly sessionExpired: boolean
  readonly conflictDetected: boolean
  readonly partialFailure: boolean
}

export function resolveSettingsResilienceState(
  c: SettingsResilienceConditions,
): SettingsResilienceState {
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

export interface DangerZoneConditions extends SettingsResilienceConditions {
  readonly payoutRunActive: boolean
}

/**
 * S-6.11 Danger Zone resolver. Transfer and Delete cannot be submitted
 * offline — ownership and deletion are never queued.
 */
export function resolveDangerZoneResilience(c: DangerZoneConditions): SettingsResilienceState {
  if (c.isOffline) return 'offline'
  return resolveSettingsResilienceState(c)
}

export type SettingsRetryStrategy = 'none' | 'auto' | 'manual'

export function settingsRetryStrategy(state: SettingsResilienceState): SettingsRetryStrategy {
  if (state === 'offline' || state === 'server_error') return 'auto'
  if (state === 'partial_failure' || state === 'conflict') return 'manual'
  return 'none'
}

export function settingsBackoffDelayMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 16_000)
}
