import { describe, expect, test } from 'bun:test'
import {
  createCleanBufferMap,
  dirtySectionCount,
  footerLabel,
  hasUnsavedChanges,
  isDiscardButtonActive,
  isSaveButtonDisabled,
  resolveSwitchAction,
  SETTINGS_SECTIONS,
} from '#/features/settings/settings.save-state'

describe('SETTINGS_SECTIONS', () => {
  test('10 sections including danger', () => {
    expect(SETTINGS_SECTIONS).toHaveLength(10)
    expect(SETTINGS_SECTIONS).toContain('danger')
  })
})
describe('createCleanBufferMap', () => {
  test('all sections start idle', () => {
    const map = createCleanBufferMap()
    for (const s of SETTINGS_SECTIONS) {
      expect(map[s].saveState).toBe('idle')
    }
  })
})
describe('hasUnsavedChanges', () => {
  test('false for clean map', () => {
    expect(hasUnsavedChanges(createCleanBufferMap())).toBe(false)
  })
  test('true when dirty', () => {
    const map = createCleanBufferMap() as any
    map.general = { section: 'general', saveState: 'dirty', lastSavedAt: null, error: null }
    expect(hasUnsavedChanges(map)).toBe(true)
  })
})
describe('resolveSwitchAction', () => {
  test('proceed when clean', () => {
    expect(resolveSwitchAction(createCleanBufferMap(), 'general').kind).toBe('proceed')
  })
  test('flush_first when dirty', () => {
    const map = createCleanBufferMap() as any
    map.general = { section: 'general', saveState: 'dirty', lastSavedAt: null, error: null }
    expect(resolveSwitchAction(map, 'general').kind).toBe('flush_first')
  })
  test('confirm_discard when error', () => {
    const map = createCleanBufferMap() as any
    map.general = {
      section: 'general',
      saveState: 'error',
      lastSavedAt: null,
      error: 'Save failed',
    }
    const action = resolveSwitchAction(map, 'general')
    expect(action.kind).toBe('confirm_discard')
  })
})
describe('footerLabel', () => {
  test('idle → All changes saved', () => expect(footerLabel('idle')).toContain('All changes saved'))
  test('dirty → Unsaved changes', () => expect(footerLabel('dirty')).toContain('Unsaved changes'))
  test('saving → Saving…', () => expect(footerLabel('saving')).toBe('Saving…'))
  test('error → Save failed', () => expect(footerLabel('error')).toContain('Save failed'))
})
describe('isSaveButtonDisabled', () => {
  test('true for idle/saved/saving', () => {
    expect(isSaveButtonDisabled('idle')).toBe(true)
    expect(isSaveButtonDisabled('saved')).toBe(true)
    expect(isSaveButtonDisabled('saving')).toBe(true)
  })
  test('false for dirty/error', () => {
    expect(isSaveButtonDisabled('dirty')).toBe(false)
    expect(isSaveButtonDisabled('error')).toBe(false)
  })
})
describe('isDiscardButtonActive', () => {
  test('true for dirty/error', () => {
    expect(isDiscardButtonActive('dirty')).toBe(true)
    expect(isDiscardButtonActive('error')).toBe(true)
  })
  test('false for idle/saved/saving', () => {
    expect(isDiscardButtonActive('idle')).toBe(false)
  })
})
describe('dirtySectionCount', () => {
  test('0 for clean map', () => {
    expect(dirtySectionCount(createCleanBufferMap())).toBe(0)
  })
  test('counts dirty sections', () => {
    const map = createCleanBufferMap() as any
    map.general = { section: 'general', saveState: 'dirty', lastSavedAt: null, error: null }
    map.team = { section: 'team', saveState: 'dirty', lastSavedAt: null, error: null }
    expect(dirtySectionCount(map)).toBe(2)
  })
})
