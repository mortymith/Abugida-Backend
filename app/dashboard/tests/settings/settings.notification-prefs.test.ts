import { describe, expect, test } from 'bun:test'
import {
  isSuppressedByQuietHours,
  shouldDisableEmailToggle,
  quietHoursLabel,
} from '#/features/settings/settings.notification-prefs'
import type { NotificationPreferences } from '#/features/settings/settings.notification-prefs'

const prefs: NotificationPreferences = {
  channels: { inApp: 'on', telegram: 'on', email: 'on' },
  perType: {} as any,
  digest: 'off',
  digestTime: '08:00',
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
}
describe('isSuppressedByQuietHours', () => {
  test('true during quiet hours (overnight)', () => {
    expect(isSuppressedByQuietHours('new_enrollment', '23:00', prefs)).toBe(true)
    expect(isSuppressedByQuietHours('new_enrollment', '03:00', prefs)).toBe(true)
  })
  test('false outside quiet hours', () => {
    expect(isSuppressedByQuietHours('new_enrollment', '12:00', prefs)).toBe(false)
  })
  test('critical alerts never suppressed', () => {
    expect(isSuppressedByQuietHours('payment_failed', '23:00', prefs)).toBe(false)
  })
})
describe('shouldDisableEmailToggle', () => {
  test('disabled when not verified', () => {
    const r = shouldDisableEmailToggle(false)
    expect(r.disabled).toBe(true)
    expect(r.reason).toContain('No verified email')
  })
  test('enabled when verified', () => {
    expect(shouldDisableEmailToggle(true).disabled).toBe(false)
  })
})
describe('quietHoursLabel', () => {
  test('names range + critical alerts', () => {
    expect(quietHoursLabel(prefs)).toContain('22:00')
    expect(quietHoursLabel(prefs)).toContain('Critical alerts')
  })
})
