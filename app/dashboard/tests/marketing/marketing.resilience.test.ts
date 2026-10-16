import { describe, expect, test } from 'bun:test'
import {
  marketingBackoffDelayMs,
  marketingRetryStrategy,
  resolveAffiliateResilience,
  resolveCampaignResilience,
  resolveCouponResilience,
  resolveMarketingResilienceState,
} from '#/features/marketing/marketing.resilience'
import type { MarketingResilienceConditions } from '#/features/marketing/marketing.resilience'

const OK: MarketingResilienceConditions = {
  httpStatus: 200,
  isOffline: false,
  wasOffline: false,
  sessionExpired: false,
  conflictDetected: false,
  partialFailure: false,
}
describe('resolveMarketingResilienceState', () => {
  test('session_expired beats everything', () => {
    expect(
      resolveMarketingResilienceState({
        ...OK,
        sessionExpired: true,
        isOffline: true,
        httpStatus: 403,
      }),
    ).toBe('session_expired')
  })
  test('offline beats forbidden', () => {
    expect(resolveMarketingResilienceState({ ...OK, isOffline: true, httpStatus: 403 })).toBe(
      'offline',
    )
  })
  test('forbidden beats not_found', () => {
    expect(resolveMarketingResilienceState({ ...OK, httpStatus: 403 })).toBe('forbidden')
  })
  test('ok when clear', () => expect(resolveMarketingResilienceState(OK)).toBe('ok'))
})
describe('resolveCampaignResilience', () => {
  test('offline when send in flight + offline', () => {
    expect(resolveCampaignResilience({ ...OK, isOffline: true, sendInFlight: true })).toBe(
      'offline',
    )
  })
})
describe('resolveCouponResilience', () => {
  test('offline when generating + offline', () => {
    expect(resolveCouponResilience({ ...OK, isOffline: true, generating: true })).toBe('offline')
  })
})
describe('resolveAffiliateResilience', () => {
  test('offline when payout run in flight + offline', () => {
    expect(resolveAffiliateResilience({ ...OK, isOffline: true, payoutRunInFlight: true })).toBe(
      'offline',
    )
  })
})
describe('marketingRetryStrategy', () => {
  test('auto for offline/server_error', () => {
    expect(marketingRetryStrategy('offline')).toBe('auto')
    expect(marketingRetryStrategy('server_error')).toBe('auto')
  })
  test('manual for conflict/partial_failure', () => {
    expect(marketingRetryStrategy('conflict')).toBe('manual')
    expect(marketingRetryStrategy('partial_failure')).toBe('manual')
  })
})
describe('marketingBackoffDelayMs', () => {
  test('exponential 1s→16s cap', () => {
    expect(marketingBackoffDelayMs(0)).toBe(1000)
    expect(marketingBackoffDelayMs(4)).toBe(16000)
    expect(marketingBackoffDelayMs(5)).toBe(16000)
  })
})
