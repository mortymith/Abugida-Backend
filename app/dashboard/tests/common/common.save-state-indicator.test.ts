import { describe, expect, test } from 'bun:test'
import {
  AUTOSAVE_IDLE_MS,
  isReloadActionAvailable,
  isRetryActionAvailable,
  isSaveActionAvailable,
  saveStateAriaLive,
  saveStateLabel,
  SAVE_STATE_LABELS,
  shouldGuardBeforeUnload,
  shouldNeverShowBothVariants,
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
    const date = new Date('2026-01-15T14:02:00Z')
    const label = saveStateLabel('saved', date)
    expect(label).toContain('2:02') // locale-dependent 12h format
  })
  test('idle without timestamp', () => {
    expect(saveStateLabel('idle')).toBe('All changes saved')
  })
})
describe('saveStateAriaLive', () => {
  test('compact error → assertive', () => {
    expect(saveStateAriaLive('error', 'compact')).toBe('assertive')
  })
  test('compact conflict → assertive', () => {
    expect(saveStateAriaLive('conflict', 'compact')).toBe('assertive')
  })
  test('compact idle → off', () => {
    expect(saveStateAriaLive('idle', 'compact')).toBe('off')
  })
  test('full → polite', () => {
    expect(saveStateAriaLive('saving', 'full')).toBe('polite')
  })
})
describe('shouldTransitionToIdle', () => {
  test('true when saved > 4s', () => {
    expect(shouldTransitionToIdle('saved', 1000, 6000)).toBe(true)
  })
  test('false when saved < 4s', () => {
    expect(shouldTransitionToIdle('saved', 1000, 2000)).toBe(false)
  })
  test('false for non-saved states', () => {
    expect(shouldTransitionToIdle('dirty', 1000, 6000)).toBe(false)
  })
})
describe('shouldShowSavingMinDuration', () => {
  test('true within 300ms', () => expect(shouldShowSavingMinDuration(1000, 1100)).toBe(true))
  test('false after 300ms', () => expect(shouldShowSavingMinDuration(1000, 1500)).toBe(false))
})
describe('action availability', () => {
  test('Save action for dirty/error', () => {
    expect(isSaveActionAvailable('dirty')).toBe(true)
    expect(isSaveActionAvailable('error')).toBe(true)
    expect(isSaveActionAvailable('idle')).toBe(false)
  })
  test('Retry for error only', () => {
    expect(isRetryActionAvailable('error')).toBe(true)
    expect(isRetryActionAvailable('dirty')).toBe(false)
  })
  test('Reload for conflict only', () => {
    expect(isReloadActionAvailable('conflict')).toBe(true)
    expect(isReloadActionAvailable('error')).toBe(false)
  })
})
describe('shouldNeverShowBothVariants', () => {
  test('true when only one mounted', () => {
    expect(shouldNeverShowBothVariants(true, false)).toBe(true)
    expect(shouldNeverShowBothVariants(false, true)).toBe(true)
  })
  test('false when both mounted (violation)', () => {
    expect(shouldNeverShowBothVariants(true, true)).toBe(false)
  })
})

describe('autosave invariants (spec 11)', () => {
  test('autosave idle window is 60s after the last edit', () => {
    expect(AUTOSAVE_IDLE_MS).toBe(60_000)
  })
  test('"Saved" only after the server confirms', () => {
    expect(shouldShowSaved(true)).toBe(true)
    expect(shouldShowSaved(false)).toBe(false)
  })
  test('beforeunload is guarded while work is unsaved or in flight', () => {
    expect(shouldGuardBeforeUnload('dirty')).toBe(true)
    expect(shouldGuardBeforeUnload('saving')).toBe(true)
    expect(shouldGuardBeforeUnload('error')).toBe(true)
    expect(shouldGuardBeforeUnload('conflict')).toBe(true)
    expect(shouldGuardBeforeUnload('idle')).toBe(false)
    expect(shouldGuardBeforeUnload('saved')).toBe(false)
  })
})
