import { describe, expect, test } from 'bun:test'
import {
  AUTOSAVE_IDLE_MS,
  isReloadActionAvailable,
  isRetryActionAvailable,
  isSaveActionAvailable,
  SAVE_STATE_LABELS,
  saveStateAriaLive,
  saveStateLabel,
  shouldGuardBeforeUnload,
  shouldShowSaved,
  shouldShowSavingMinDuration,
  shouldTransitionToIdle,
} from '#/components/common/common.save-state-indicator'

describe('SAVE_STATE_LABELS', () => {
  test('8 states', () => {
    expect(Object.keys(SAVE_STATE_LABELS)).toHaveLength(8)
  })
  test('idle → All changes saved', () =>
    expect(SAVE_STATE_LABELS.idle).toContain('All changes saved'))
  test('error → Save failed', () => expect(SAVE_STATE_LABELS.error).toContain('Save failed'))
  test('offline → queued', () => expect(SAVE_STATE_LABELS.offline).toContain('queued'))
})
describe('saveStateLabel', () => {
  test('saved includes timestamp', () => {
    const label = saveStateLabel('saved', new Date('2026-01-15T14:02:00Z'))
    expect(label).toContain('saved at')
  })
})
describe('saveStateAriaLive', () => {
  test('compact error → assertive', () =>
    expect(saveStateAriaLive('error', 'compact')).toBe('assertive'))
  test('compact idle → off', () => expect(saveStateAriaLive('idle', 'compact')).toBe('off'))
  test('full → polite', () => expect(saveStateAriaLive('saving', 'full')).toBe('polite'))
})
describe('shouldTransitionToIdle', () => {
  test('true after 4s saved', () => expect(shouldTransitionToIdle('saved', 1000, 6000)).toBe(true))
  test('false before 4s', () => expect(shouldTransitionToIdle('saved', 1000, 2000)).toBe(false))
})
describe('shouldShowSavingMinDuration', () => {
  test('true within 300ms', () => expect(shouldShowSavingMinDuration(1000, 1100)).toBe(true))
  test('false after 300ms', () => expect(shouldShowSavingMinDuration(1000, 1500)).toBe(false))
})
describe('action availability', () => {
  test('Save for dirty/error', () => {
    expect(isSaveActionAvailable('dirty')).toBe(true)
    expect(isSaveActionAvailable('idle')).toBe(false)
  })
  test('Retry for error only', () => expect(isRetryActionAvailable('error')).toBe(true))
  test('Reload for conflict only', () => expect(isReloadActionAvailable('conflict')).toBe(true))
})
describe('shouldShowSaved', () => {
  test('true when server confirmed', () => expect(shouldShowSaved(true)).toBe(true))
  test('false when optimistic', () => expect(shouldShowSaved(false)).toBe(false))
})
describe('shouldGuardBeforeUnload', () => {
  test('true for dirty', () => expect(shouldGuardBeforeUnload('dirty')).toBe(true))
  test('false for idle', () => expect(shouldGuardBeforeUnload('idle')).toBe(false))
})
describe('AUTOSAVE_IDLE_MS', () => {
  test('60 seconds', () => expect(AUTOSAVE_IDLE_MS).toBe(60_000))
})
