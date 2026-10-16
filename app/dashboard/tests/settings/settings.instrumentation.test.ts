import { describe, expect, test } from 'bun:test'
import {
  SETTINGS_INSTRUMENTATION_EVENTS,
  trackSettingsEvent,
  validateSettingsPayload,
} from '#/features/settings/settings.instrumentation'

describe('SETTINGS_INSTRUMENTATION_EVENTS', () => {
  test('includes events for all screens', () => {
    expect(SETTINGS_INSTRUMENTATION_EVENTS).toContain('settings_general_saved')
    expect(SETTINGS_INSTRUMENTATION_EVENTS).toContain('team_invite_created')
    expect(SETTINGS_INSTRUMENTATION_EVENTS).toContain('danger_purged')
    expect(SETTINGS_INSTRUMENTATION_EVENTS).toContain('roles_capability_changed')
  })
})
describe('validateSettingsPayload', () => {
  test('valid payload', () => {
    expect(validateSettingsPayload({ id: 'org-1', count: 5 })).toBeNull()
  })
  test('rejects empty id', () => {
    expect(validateSettingsPayload({ id: '' })).toContain('non-empty')
  })
  test('rejects email (PII)', () => {
    expect(validateSettingsPayload({ id: 'o1', email: 'a@b.com' } as any)).toContain('email')
  })
  test('rejects secret', () => {
    expect(validateSettingsPayload({ id: 'o1', secret: 'xyz' } as any)).toContain('secret')
  })
})
describe('trackSettingsEvent', () => {
  test('calls send when valid', () => {
    const sent: string[] = []
    trackSettingsEvent('settings_general_saved', { id: 'o1' }, (e) => sent.push(e))
    expect(sent).toHaveLength(1)
  })
  test('does not call send when invalid', () => {
    const sent: string[] = []
    trackSettingsEvent('settings_general_saved', { id: '' }, (e) => sent.push(e))
    expect(sent).toHaveLength(0)
  })
})
