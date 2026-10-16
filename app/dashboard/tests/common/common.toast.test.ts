import { describe, expect, test } from 'bun:test'
import {
  isUndoExpired,
  shouldAutoDismiss,
  shouldPauseTimer,
  toastAriaRole,
  toastDurationMs,
  undoTimeRemainingMs,
  UNDO_TOAST_DURATION_MS,
} from '#/components/common/common.toast'

describe('toastAriaRole', () => {
  test('alert for error', () => expect(toastAriaRole('error')).toBe('alert'))
  test('status for success', () => expect(toastAriaRole('success')).toBe('status'))
  test('status for info', () => expect(toastAriaRole('info')).toBe('status'))
  test('status for warning', () => expect(toastAriaRole('warning')).toBe('status'))
})
describe('shouldAutoDismiss', () => {
  test('true for success', () => expect(shouldAutoDismiss('success')).toBe(true))
  test('true for info', () => expect(shouldAutoDismiss('info')).toBe(true))
  test('false for warning', () => expect(shouldAutoDismiss('warning')).toBe(false))
  test('false for error', () => expect(shouldAutoDismiss('error')).toBe(false))
})
describe('toastDurationMs', () => {
  test('5s for success', () => expect(toastDurationMs('success')).toBe(5000))
  test('null for error', () => expect(toastDurationMs('error')).toBeNull())
  test('null for warning', () => expect(toastDurationMs('warning')).toBeNull())
  test('null when hasAction', () => expect(toastDurationMs('success', true)).toBeNull())
})
describe('undo timer', () => {
  const startedAt = 1000
  test('full duration at start', () => {
    expect(undoTimeRemainingMs(startedAt, 1000)).toBe(UNDO_TOAST_DURATION_MS)
  })
  test('half remaining after 5s', () => {
    expect(undoTimeRemainingMs(startedAt, 6000)).toBe(5000)
  })
  test('expired after 10s', () => {
    expect(isUndoExpired(startedAt, 11000)).toBe(true)
  })
  test('not expired before 10s', () => {
    expect(isUndoExpired(startedAt, 9000)).toBe(false)
  })
})
describe('shouldPauseTimer', () => {
  test('true when hovered', () => expect(shouldPauseTimer(true, false)).toBe(true))
  test('true when focused', () => expect(shouldPauseTimer(false, true)).toBe(true))
  test('false when neither', () => expect(shouldPauseTimer(false, false)).toBe(false))
})
