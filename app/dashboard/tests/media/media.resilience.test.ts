import { describe, expect, test } from 'bun:test'
import {
  mediaBackoffDelayMs,
  MEDIA_RESILIENCE_STATES,
  mediaRetryStrategy,
  resolveMediaResilienceState,
  resolvePreviewModalResilience,
  resolveTranscriptEditorResilience,
  resolveUploadModalResilience,
} from '#/features/media/media.resilience'
import type { MediaResilienceConditions } from '#/features/media/media.resilience'

const OK: MediaResilienceConditions = {
  httpStatus: 200,
  isOffline: false,
  wasOffline: false,
  sessionExpired: false,
  conflictDetected: false,
  partialFailure: false,
  hasData: true,
}

describe('MEDIA_RESILIENCE_STATES', () => {
  test('includes all 9 states', () => {
    expect(MEDIA_RESILIENCE_STATES).toEqual([
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

describe('resolveMediaResilienceState — priority order', () => {
  test('session_expired beats everything', () => {
    const state = resolveMediaResilienceState({
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
    expect(resolveMediaResilienceState({ ...OK, isOffline: true, httpStatus: 403 })).toBe('offline')
  })
  test('forbidden (403) beats not_found (404)', () => {
    expect(resolveMediaResilienceState({ ...OK, httpStatus: 403 })).toBe('forbidden')
  })
  test('not_found (404) beats conflict', () => {
    expect(resolveMediaResilienceState({ ...OK, httpStatus: 404, conflictDetected: true })).toBe(
      'not_found',
    )
  })
  test('conflict beats partial_failure', () => {
    expect(
      resolveMediaResilienceState({ ...OK, conflictDetected: true, partialFailure: true }),
    ).toBe('conflict')
  })
  test('partial_failure beats server_error', () => {
    expect(resolveMediaResilienceState({ ...OK, partialFailure: true, httpStatus: 500 })).toBe(
      'partial_failure',
    )
  })
  test('server_error (5xx) beats reconnected', () => {
    expect(resolveMediaResilienceState({ ...OK, httpStatus: 500, wasOffline: true })).toBe(
      'server_error',
    )
  })
  test('reconnected when wasOffline and now online', () => {
    expect(resolveMediaResilienceState({ ...OK, wasOffline: true, isOffline: false })).toBe(
      'reconnected',
    )
  })
  test('ok when all clear', () => {
    expect(resolveMediaResilienceState(OK)).toBe('ok')
  })
})

describe('resolveUploadModalResilience', () => {
  test('session_expired with uploads in flight', () => {
    const state = resolveUploadModalResilience({
      ...OK,
      sessionExpired: true,
      uploadsInFlight: true,
      offlineQueueCount: 0,
    })
    expect(state).toBe('session_expired')
  })
  test('offline with queued uploads', () => {
    const state = resolveUploadModalResilience({
      ...OK,
      isOffline: true,
      uploadsInFlight: false,
      offlineQueueCount: 3,
    })
    expect(state).toBe('offline')
  })
})

describe('resolvePreviewModalResilience', () => {
  test('unsupported_format before trying', () => {
    const state = resolvePreviewModalResilience({
      ...OK,
      unsupportedFormat: true,
      previewFailed: false,
      mediaBytesFailed: false,
    })
    expect(state).toBe('unsupported_format')
  })
  test('preview_failed on actual failure', () => {
    const state = resolvePreviewModalResilience({
      ...OK,
      unsupportedFormat: false,
      previewFailed: true,
      mediaBytesFailed: false,
    })
    expect(state).toBe('preview_failed')
  })
  test('offline beats unsupported_format', () => {
    const state = resolvePreviewModalResilience({
      ...OK,
      isOffline: true,
      unsupportedFormat: true,
      previewFailed: false,
      mediaBytesFailed: false,
    })
    expect(state).toBe('offline')
  })
  test('ok when all clear', () => {
    const state = resolvePreviewModalResilience({
      ...OK,
      unsupportedFormat: false,
      previewFailed: false,
      mediaBytesFailed: false,
    })
    expect(state).toBe('ok')
  })
})

describe('resolveTranscriptEditorResilience', () => {
  test('generating state when STT is running', () => {
    const state = resolveTranscriptEditorResilience({
      ...OK,
      generating: true,
      queuedEditsCount: 0,
    })
    expect(state).toBe('generating')
  })
  test('offline beats generating', () => {
    const state = resolveTranscriptEditorResilience({
      ...OK,
      isOffline: true,
      generating: true,
      queuedEditsCount: 0,
    })
    expect(state).toBe('offline')
  })
  test('ok when not generating', () => {
    const state = resolveTranscriptEditorResilience({
      ...OK,
      generating: false,
      queuedEditsCount: 0,
    })
    expect(state).toBe('ok')
  })
})

describe('mediaRetryStrategy', () => {
  test('offline and server_error use auto retry', () => {
    expect(mediaRetryStrategy('offline')).toBe('auto')
    expect(mediaRetryStrategy('server_error')).toBe('auto')
  })
  test('conflict and partial_failure use manual retry', () => {
    expect(mediaRetryStrategy('conflict')).toBe('manual')
    expect(mediaRetryStrategy('partial_failure')).toBe('manual')
  })
  test('ok and reconnected have no retry', () => {
    expect(mediaRetryStrategy('ok')).toBe('none')
    expect(mediaRetryStrategy('reconnected')).toBe('none')
  })
})

describe('mediaBackoffDelayMs', () => {
  test('exponential: 1s, 2s, 4s, 8s, 16s cap', () => {
    expect(mediaBackoffDelayMs(0)).toBe(1000)
    expect(mediaBackoffDelayMs(1)).toBe(2000)
    expect(mediaBackoffDelayMs(2)).toBe(4000)
    expect(mediaBackoffDelayMs(3)).toBe(8000)
    expect(mediaBackoffDelayMs(4)).toBe(16000)
    expect(mediaBackoffDelayMs(5)).toBe(16000) // capped
  })
})
