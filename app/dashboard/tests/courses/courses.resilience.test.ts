import { describe, expect, test } from 'bun:test'
import {
  backoffDelayMs,
  blocksAllInteraction,
  isAutoRecoverable,
  RESILIENCE_STATES,
  resolveResilienceState,
  retryStrategy,
} from '#/features/courses/courses.resilience'
import type { ResilienceConditions } from '#/features/courses/courses.resilience'

const OK: ResilienceConditions = {
  httpStatus: 200,
  isOffline: false,
  wasOffline: false,
  sessionExpired: false,
  conflictDetected: false,
  partialFailure: false,
  hasData: true,
}

describe('resolveResilienceState — priority order', () => {
  test('session_expired beats everything', () => {
    const state = resolveResilienceState({
      ...OK,
      sessionExpired: true,
      isOffline: true,
      httpStatus: 403,
      conflictDetected: true,
      partialFailure: true,
    })
    expect(state).toBe('session_expired')
  })

  test('offline beats forbidden/not_found', () => {
    const state = resolveResilienceState({
      ...OK,
      isOffline: true,
      httpStatus: 403,
    })
    expect(state).toBe('offline')
  })

  test('forbidden (403) beats not_found (404)', () => {
    const state = resolveResilienceState({
      ...OK,
      httpStatus: 403,
    })
    expect(state).toBe('forbidden')
  })

  test('not_found (404) beats conflict', () => {
    const state = resolveResilienceState({
      ...OK,
      httpStatus: 404,
      conflictDetected: true,
    })
    expect(state).toBe('not_found')
  })

  test('conflict beats partial_failure', () => {
    const state = resolveResilienceState({
      ...OK,
      conflictDetected: true,
      partialFailure: true,
    })
    expect(state).toBe('conflict')
  })

  test('partial_failure beats server_error', () => {
    const state = resolveResilienceState({
      ...OK,
      partialFailure: true,
      httpStatus: 500,
    })
    expect(state).toBe('partial_failure')
  })

  test('server_error (5xx) beats reconnected', () => {
    const state = resolveResilienceState({
      ...OK,
      httpStatus: 500,
      wasOffline: true,
    })
    expect(state).toBe('server_error')
  })

  test('reconnected when wasOffline and now online', () => {
    const state = resolveResilienceState({
      ...OK,
      wasOffline: true,
      isOffline: false,
    })
    expect(state).toBe('reconnected')
  })

  test('ok when all conditions clear', () => {
    expect(resolveResilienceState(OK)).toBe('ok')
  })
})

describe('RESILIENCE_STATES', () => {
  test('includes all 9 states', () => {
    expect(RESILIENCE_STATES).toEqual([
      'ok',
      'forbidden',
      'not_found',
      'offline',
      'reconnected',
      'session_expired',
      'conflict',
      'partial_failure',
      'server_error',
    ])
  })
})

describe('isAutoRecoverable', () => {
  test('offline, reconnected, server_error are auto-recoverable', () => {
    expect(isAutoRecoverable('offline')).toBe(true)
    expect(isAutoRecoverable('reconnected')).toBe(true)
    expect(isAutoRecoverable('server_error')).toBe(true)
  })
  test('forbidden, not_found, session_expired, conflict, partial_failure are not', () => {
    expect(isAutoRecoverable('forbidden')).toBe(false)
    expect(isAutoRecoverable('not_found')).toBe(false)
    expect(isAutoRecoverable('session_expired')).toBe(false)
    expect(isAutoRecoverable('conflict')).toBe(false)
    expect(isAutoRecoverable('partial_failure')).toBe(false)
  })
})

describe('blocksAllInteraction', () => {
  test('forbidden, not_found, session_expired block all interaction', () => {
    expect(blocksAllInteraction('forbidden')).toBe(true)
    expect(blocksAllInteraction('not_found')).toBe(true)
    expect(blocksAllInteraction('session_expired')).toBe(true)
  })
  test('offline, conflict, partial_failure allow partial interaction', () => {
    expect(blocksAllInteraction('offline')).toBe(false)
    expect(blocksAllInteraction('conflict')).toBe(false)
    expect(blocksAllInteraction('partial_failure')).toBe(false)
  })
})

describe('retryStrategy', () => {
  test('offline and server_error use auto retry', () => {
    expect(retryStrategy('offline')).toBe('auto')
    expect(retryStrategy('server_error')).toBe('auto')
  })
  test('conflict and partial_failure use manual retry', () => {
    expect(retryStrategy('conflict')).toBe('manual')
    expect(retryStrategy('partial_failure')).toBe('manual')
  })
  test('ok and reconnected have no retry', () => {
    expect(retryStrategy('ok')).toBe('none')
    expect(retryStrategy('reconnected')).toBe('none')
  })
})

describe('backoffDelayMs', () => {
  test('exponential: 1s, 2s, 4s, 8s, 16s cap', () => {
    expect(backoffDelayMs(0)).toBe(1000)
    expect(backoffDelayMs(1)).toBe(2000)
    expect(backoffDelayMs(2)).toBe(4000)
    expect(backoffDelayMs(3)).toBe(8000)
    expect(backoffDelayMs(4)).toBe(16000)
    expect(backoffDelayMs(5)).toBe(16000) // capped
    expect(backoffDelayMs(100)).toBe(16000)
  })
})
