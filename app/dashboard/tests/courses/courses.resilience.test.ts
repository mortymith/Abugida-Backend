import { describe, expect, test } from 'bun:test'
import {
  coursesBackoffDelayMs,
  coursesRetryStrategy,
  resolveCoursesResilienceState,
  resolveWorkspaceResilience,
} from '#/features/courses/courses.resilience'
import type { CoursesResilienceConditions } from '#/features/courses/courses.resilience'

const OK: CoursesResilienceConditions = {
  httpStatus: 200,
  isOffline: false,
  wasOffline: false,
  sessionExpired: false,
  conflictDetected: false,
  partialFailure: false,
}
describe('resolveCoursesResilienceState', () => {
  test('session_expired beats everything', () => {
    expect(
      resolveCoursesResilienceState({
        ...OK,
        sessionExpired: true,
        isOffline: true,
        httpStatus: 403,
      }),
    ).toBe('session_expired')
  })
  test('offline beats forbidden', () => {
    expect(resolveCoursesResilienceState({ ...OK, isOffline: true, httpStatus: 403 })).toBe(
      'offline',
    )
  })
  test('forbidden beats not_found', () => {
    expect(resolveCoursesResilienceState({ ...OK, httpStatus: 403 })).toBe('forbidden')
  })
  test('ok when clear', () => expect(resolveCoursesResilienceState(OK)).toBe('ok'))
})
describe('resolveWorkspaceResilience', () => {
  test('session_expired when item editor open + unsaved', () => {
    expect(
      resolveWorkspaceResilience({
        ...OK,
        sessionExpired: true,
        itemEditorOpen: true,
        unsavedChanges: true,
      }),
    ).toBe('session_expired')
  })
})
describe('coursesRetryStrategy', () => {
  test('auto for offline/server_error', () => {
    expect(coursesRetryStrategy('offline')).toBe('auto')
    expect(coursesRetryStrategy('server_error')).toBe('auto')
  })
  test('manual for conflict/partial_failure', () => {
    expect(coursesRetryStrategy('conflict')).toBe('manual')
  })
})
describe('coursesBackoffDelayMs', () => {
  test('exponential 1s→16s cap', () => {
    expect(coursesBackoffDelayMs(0)).toBe(1000)
    expect(coursesBackoffDelayMs(4)).toBe(16000)
  })
})
