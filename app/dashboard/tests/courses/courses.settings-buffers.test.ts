import { describe, expect, test } from 'bun:test'
import {
  createCleanBufferMap,
  dirtySectionCount,
  hasUnsavedChanges,
  resolveSwitchAction,
  sectionFlushLabel,
  SETTINGS_SECTIONS,
  shouldReplaceWithArchivedBanner,
} from '#/features/courses/courses.settings-buffers'
import type { SectionBufferMap } from '#/features/courses/courses.settings-buffers'

describe('SETTINGS_SECTIONS', () => {
  test('seven sections in spec order', () => {
    expect(SETTINGS_SECTIONS).toEqual([
      'details',
      'pricing_enrollment',
      'curriculum_defaults',
      'live_sessions',
      'completion_certificates',
      'review_approval',
      'danger_zone',
    ])
  })
})

describe('createCleanBufferMap', () => {
  test('every section starts idle', () => {
    const map = createCleanBufferMap()
    for (const section of SETTINGS_SECTIONS) {
      expect(map[section].saveState).toBe('idle')
      expect(map[section].error).toBeNull()
      expect(map[section].lastSavedAt).toBeNull()
    }
  })
})

describe('hasUnsavedChanges', () => {
  test('false for clean map', () => {
    expect(hasUnsavedChanges(createCleanBufferMap())).toBe(false)
  })

  test('true when any section is dirty', () => {
    const map = createCleanBufferMap() as Record<string, any>
    map.details = { section: 'details', saveState: 'dirty', lastSavedAt: null, error: null }
    expect(hasUnsavedChanges(map as SectionBufferMap)).toBe(true)
  })

  test('true when any section is saving', () => {
    const map = createCleanBufferMap() as Record<string, any>
    map.pricing_enrollment = {
      section: 'pricing_enrollment',
      saveState: 'saving',
      lastSavedAt: null,
      error: null,
    }
    expect(hasUnsavedChanges(map as SectionBufferMap)).toBe(true)
  })

  test('true when any section is in error', () => {
    const map = createCleanBufferMap() as Record<string, any>
    map.danger_zone = {
      section: 'danger_zone',
      saveState: 'error',
      lastSavedAt: null,
      error: 'Save failed',
    }
    expect(hasUnsavedChanges(map as SectionBufferMap)).toBe(true)
  })
})

describe('dirtySectionCount', () => {
  test('0 for clean map', () => {
    expect(dirtySectionCount(createCleanBufferMap())).toBe(0)
  })

  test('counts dirty sections', () => {
    const map = createCleanBufferMap() as Record<string, any>
    map.details = { section: 'details', saveState: 'dirty', lastSavedAt: null, error: null }
    map.pricing_enrollment = {
      section: 'pricing_enrollment',
      saveState: 'dirty',
      lastSavedAt: null,
      error: null,
    }
    expect(dirtySectionCount(map as SectionBufferMap)).toBe(2)
  })
})

describe('resolveSwitchAction', () => {
  test('proceed when current section is clean', () => {
    const map = createCleanBufferMap()
    const action = resolveSwitchAction(map, 'details')
    expect(action.kind).toBe('proceed')
  })

  test('flush_first when current section is dirty', () => {
    const map = createCleanBufferMap() as Record<string, any>
    map.details = { section: 'details', saveState: 'dirty', lastSavedAt: null, error: null }
    const action = resolveSwitchAction(map as SectionBufferMap, 'details')
    expect(action.kind).toBe('flush_first')
  })

  test('confirm_discard when current section is in error', () => {
    const map = createCleanBufferMap() as Record<string, any>
    map.details = {
      section: 'details',
      saveState: 'error',
      lastSavedAt: null,
      error: 'Save failed',
    }
    const action = resolveSwitchAction(map as SectionBufferMap, 'details')
    expect(action.kind).toBe('confirm_discard')
  })
})

describe('sectionFlushLabel', () => {
  test('disabled with "No unsaved changes" when idle', () => {
    const result = sectionFlushLabel('idle')
    expect(result.disabled).toBe(true)
    expect(result.ariaDescribedBy).toBe('No unsaved changes')
  })

  test('disabled when saved', () => {
    expect(sectionFlushLabel('saved').disabled).toBe(true)
  })

  test('disabled when saving', () => {
    expect(sectionFlushLabel('saving').disabled).toBe(true)
  })

  test('enabled with "Retry save" when error', () => {
    const result = sectionFlushLabel('error')
    expect(result.disabled).toBe(false)
    expect(result.label).toBe('Retry save')
    expect(result.ariaDescribedBy).toContain('retry')
  })

  test('enabled with "Flush now" when dirty', () => {
    const result = sectionFlushLabel('dirty')
    expect(result.disabled).toBe(false)
    expect(result.label).toBe('Flush now')
  })
})

describe('shouldReplaceWithArchivedBanner', () => {
  test('true when course is archived', () => {
    expect(shouldReplaceWithArchivedBanner('archived')).toBe(true)
  })

  test('false for any other status', () => {
    expect(shouldReplaceWithArchivedBanner('draft')).toBe(false)
    expect(shouldReplaceWithArchivedBanner('published')).toBe(false)
    expect(shouldReplaceWithArchivedBanner('in_review')).toBe(false)
  })
})
