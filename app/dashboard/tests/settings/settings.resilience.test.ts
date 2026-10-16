import { describe, expect, test } from 'bun:test'
import {
  resolveSettingsResilienceState,
  resolveDangerZoneResilience,
  settingsRetryStrategy,
} from '#/features/settings/settings.resilience'
import type { SettingsResilienceConditions } from '#/features/settings/settings.resilience'

const OK: SettingsResilienceConditions = {
  httpStatus: 200,
  isOffline: false,
  wasOffline: false,
  sessionExpired: false,
  conflictDetected: false,
  partialFailure: false,
}
describe('resolveSettingsResilienceState', () => {
  test('session_expired beats everything', () => {
    expect(
      resolveSettingsResilienceState({
        ...OK,
        sessionExpired: true,
        isOffline: true,
        httpStatus: 403,
      }),
    ).toBe('session_expired')
  })
  test('offline beats forbidden', () => {
    expect(resolveSettingsResilienceState({ ...OK, isOffline: true, httpStatus: 403 })).toBe(
      'offline',
    )
  })
  test('forbidden beats not_found', () => {
    expect(resolveSettingsResilienceState({ ...OK, httpStatus: 403 })).toBe('forbidden')
  })
  test('ok when clear', () => {
    expect(resolveSettingsResilienceState(OK)).toBe('ok')
  })
})
describe('resolveDangerZoneResilience', () => {
  test('offline when offline (never queue)', () => {
    expect(resolveDangerZoneResilience({ ...OK, isOffline: true, payoutRunActive: false })).toBe(
      'offline',
    )
  })
})
describe('settingsRetryStrategy', () => {
  test('auto for offline/server_error', () => {
    expect(settingsRetryStrategy('offline')).toBe('auto')
    expect(settingsRetryStrategy('server_error')).toBe('auto')
  })
  test('manual for conflict/partial_failure', () => {
    expect(settingsRetryStrategy('conflict')).toBe('manual')
    expect(settingsRetryStrategy('partial_failure')).toBe('manual')
  })
})
