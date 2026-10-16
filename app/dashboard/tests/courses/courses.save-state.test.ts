import { describe, expect, test } from 'bun:test'
import {
  canFlushNow,
  defaultDirtyExitAction,
  DIRTY_EXIT_ACTIONS,
  FLUSH_NOW_CLEAN_REASON,
  FLUSH_NOW_LABEL,
  flushNowAriaLabel,
  SAVE_STATES,
  shouldGuardBeforeUnload,
} from '#/features/courses/courses.save-state'

describe('save-state vocabulary', () => {
  test('every state has a label', () => {
    for (const state of SAVE_STATES) {
      expect(state).toBeDefined()
    }
  })

  test('Flush now is the explicit button label, never "Save"', () => {
    expect(FLUSH_NOW_LABEL).toBe('Flush now')
    expect(FLUSH_NOW_LABEL).not.toBe('Save')
  })

  test('clean reason is "No unsaved changes"', () => {
    expect(FLUSH_NOW_CLEAN_REASON).toBe('No unsaved changes')
  })
})

describe('canFlushNow', () => {
  test('disabled when clean (idle/saved) or in flight (saving)', () => {
    expect(canFlushNow('idle')).toBe(false)
    expect(canFlushNow('saved')).toBe(false)
    expect(canFlushNow('saving')).toBe(false)
  })

  test('enabled when there is something to flush (dirty/error/conflict)', () => {
    expect(canFlushNow('dirty')).toBe(true)
    expect(canFlushNow('error')).toBe(true)
    expect(canFlushNow('conflict')).toBe(true)
  })
})

describe('flushNowAriaLabel', () => {
  test('clean states expose the clean reason as aria-describedby', () => {
    expect(flushNowAriaLabel('idle')).toBe(FLUSH_NOW_CLEAN_REASON)
    expect(flushNowAriaLabel('saved')).toBe(FLUSH_NOW_CLEAN_REASON)
  })

  test('dirty exposes the action label', () => {
    expect(flushNowAriaLabel('dirty')).toBe(FLUSH_NOW_LABEL)
  })

  test('error exposes "Retry save now"', () => {
    expect(flushNowAriaLabel('error')).toBe('Retry save now')
  })

  test('conflict exposes "Review conflict"', () => {
    expect(flushNowAriaLabel('conflict')).toBe('Review conflict')
  })
})

describe('shouldGuardBeforeUnload', () => {
  test('active while dirty or flush in flight', () => {
    expect(shouldGuardBeforeUnload('dirty')).toBe(true)
    expect(shouldGuardBeforeUnload('saving')).toBe(true)
    expect(shouldGuardBeforeUnload('error')).toBe(true)
    expect(shouldGuardBeforeUnload('conflict')).toBe(true)
  })

  test('inactive when clean', () => {
    expect(shouldGuardBeforeUnload('idle')).toBe(false)
    expect(shouldGuardBeforeUnload('saved')).toBe(false)
  })
})

describe('dirty exit', () => {
  test('Discard is never the default', () => {
    for (const state of SAVE_STATES) {
      const action = defaultDirtyExitAction(state)
      expect(action).not.toBe('discard')
    }
  })

  test('default is flush-then-proceed, or retry after error', () => {
    expect(defaultDirtyExitAction('dirty')).toBe('flush-then-proceed')
    expect(defaultDirtyExitAction('error')).toBe('retry')
  })

  test('every dirty exit action is in the vocabulary', () => {
    expect(DIRTY_EXIT_ACTIONS).toEqual(['flush-then-proceed', 'retry', 'discard', 'stay'])
  })
})
