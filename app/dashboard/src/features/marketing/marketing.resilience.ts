/**
 * Marketing resilience (spec 10 § Resilience, spec 11 § Resilience States).
 * Per-screen resolvers for the 5 marketing screens.
 */

export const MARKETING_RESILIENCE_STATES = [
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

export type MarketingResilienceState = (typeof MARKETING_RESILIENCE_STATES)[number]

export interface MarketingResilienceConditions {
  readonly httpStatus: number | null
  readonly isOffline: boolean
  readonly wasOffline: boolean
  readonly sessionExpired: boolean
  readonly conflictDetected: boolean
  readonly partialFailure: boolean
}

export function resolveMarketingResilienceState(
  c: MarketingResilienceConditions,
): MarketingResilienceState {
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

export interface CampaignConditions extends MarketingResilienceConditions {
  readonly sendInFlight: boolean
}

export function resolveCampaignResilience(c: CampaignConditions): MarketingResilienceState {
  if (c.isOffline && c.sendInFlight) return 'offline'
  return resolveMarketingResilienceState(c)
}

export interface CouponConditions extends MarketingResilienceConditions {
  readonly generating: boolean
}

export function resolveCouponResilience(c: CouponConditions): MarketingResilienceState {
  if (c.isOffline && c.generating) return 'offline'
  return resolveMarketingResilienceState(c)
}

export interface PayoutConditions extends MarketingResilienceConditions {
  readonly payoutRunInFlight: boolean
}

export function resolveAffiliateResilience(c: PayoutConditions): MarketingResilienceState {
  if (c.isOffline && c.payoutRunInFlight) return 'offline'
  return resolveMarketingResilienceState(c)
}

export type MarketingRetryStrategy = 'none' | 'auto' | 'manual'

export function marketingRetryStrategy(state: MarketingResilienceState): MarketingRetryStrategy {
  if (state === 'offline' || state === 'server_error') return 'auto'
  if (state === 'partial_failure' || state === 'conflict') return 'manual'
  return 'none'
}

export function marketingBackoffDelayMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 16_000)
}
