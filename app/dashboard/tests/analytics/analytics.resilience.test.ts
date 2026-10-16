import { describe, expect, test } from 'bun:test'
import {
  analyticsBackoffDelayMs,
  analyticsRetryStrategy,
  resolveAnalyticsResilienceState,
  resolveCohortComparisonResilience,
  resolveExportResilience,
  resolveFunnelResilience,
  resolvePerformanceResilience,
  resolveQuizResilience,
} from '#/features/analytics/analytics.resilience'
import type { AnalyticsResilienceConditions } from '#/features/analytics/analytics.resilience'

const OK: AnalyticsResilienceConditions = {
  httpStatus: 200,
  isOffline: false,
  wasOffline: false,
  sessionExpired: false,
  conflictDetected: false,
  partialFailure: false,
  hasData: true,
}

describe('resolveAnalyticsResilienceState — priority', () => {
  test('session_expired beats everything', () => {
    expect(
      resolveAnalyticsResilienceState({
        ...OK,
        sessionExpired: true,
        isOffline: true,
        httpStatus: 403,
      }),
    ).toBe('session_expired')
  })
  test('offline beats forbidden', () => {
    expect(resolveAnalyticsResilienceState({ ...OK, isOffline: true, httpStatus: 403 })).toBe(
      'offline',
    )
  })
  test('forbidden beats not_found', () => {
    expect(resolveAnalyticsResilienceState({ ...OK, httpStatus: 403 })).toBe('forbidden')
  })
  test('partial_failure beats server_error', () => {
    expect(resolveAnalyticsResilienceState({ ...OK, partialFailure: true, httpStatus: 500 })).toBe(
      'partial_failure',
    )
  })
  test('ok when all clear', () => {
    expect(resolveAnalyticsResilienceState(OK)).toBe('ok')
  })
})

describe('resolvePerformanceResilience — per-panel partial failure', () => {
  test('partial_failure when summary loaded but item engagement not', () => {
    expect(
      resolvePerformanceResilience({
        ...OK,
        summaryLoaded: true,
        itemEngagementLoaded: false,
        insightsLoaded: true,
      }),
    ).toBe('partial_failure')
  })
  test('ok when all panels loaded', () => {
    expect(
      resolvePerformanceResilience({
        ...OK,
        summaryLoaded: true,
        itemEngagementLoaded: true,
        insightsLoaded: true,
      }),
    ).toBe('ok')
  })
})

describe('resolveQuizResilience', () => {
  test('partial_failure when summary loaded but distribution not', () => {
    expect(resolveQuizResilience({ ...OK, summaryLoaded: true, distributionLoaded: false })).toBe(
      'partial_failure',
    )
  })
})

describe('resolveFunnelResilience', () => {
  test('partial_failure when funnel loaded but heatmap not', () => {
    expect(resolveFunnelResilience({ ...OK, funnelLoaded: true, heatmapLoaded: false })).toBe(
      'partial_failure',
    )
  })
})

describe('resolveExportResilience', () => {
  test('offline when config form open and offline', () => {
    expect(resolveExportResilience({ ...OK, isOffline: true, configFormOpen: true })).toBe(
      'offline',
    )
  })
})

describe('resolveCohortComparisonResilience', () => {
  test('partial_failure when 3 cohorts selected but only 2 loaded', () => {
    expect(resolveCohortComparisonResilience({ ...OK, cohortCount: 3, loadedCohortCount: 2 })).toBe(
      'partial_failure',
    )
  })
  test('ok when all loaded', () => {
    expect(resolveCohortComparisonResilience({ ...OK, cohortCount: 2, loadedCohortCount: 2 })).toBe(
      'ok',
    )
  })
})

describe('analyticsRetryStrategy', () => {
  test('auto for offline and server_error', () => {
    expect(analyticsRetryStrategy('offline')).toBe('auto')
    expect(analyticsRetryStrategy('server_error')).toBe('auto')
  })
  test('manual for partial_failure', () => {
    expect(analyticsRetryStrategy('partial_failure')).toBe('manual')
  })
})

describe('analyticsBackoffDelayMs', () => {
  test('exponential: 1s, 2s, 4s, 8s, 16s cap', () => {
    expect(analyticsBackoffDelayMs(0)).toBe(1000)
    expect(analyticsBackoffDelayMs(4)).toBe(16000)
    expect(analyticsBackoffDelayMs(5)).toBe(16000)
  })
})
