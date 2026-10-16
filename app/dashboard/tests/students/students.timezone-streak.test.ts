import { describe, expect, test } from 'bun:test'
import {
  atRiskLabel,
  computeTimezoneStreaks,
  isAtRiskInTimezone,
  STREAK_HELPER_TEXT,
  timezoneDayKey,
  toTimezoneDayKeys,
} from '#/features/students/students.timezone-streak'

const ADDIS_TZ = 'Africa/Addis_Ababa'
const LA_TZ = 'America/Los_Angeles'

describe('timezoneDayKey', () => {
  test('same UTC instant → different day key in different timezones', () => {
    // 2026-01-15T22:00:00Z is 2026-01-16 in Addis (UTC+3) but 2026-01-15 in LA (UTC-8)
    const date = new Date('2026-01-15T22:00:00Z')
    expect(timezoneDayKey(date, ADDIS_TZ)).toBe('2026-01-16')
    expect(timezoneDayKey(date, LA_TZ)).toBe('2026-01-15')
  })
})

describe('toTimezoneDayKeys', () => {
  test('deduplicates + sorts', () => {
    const timestamps = [
      '2026-01-15T10:00:00Z',
      '2026-01-15T22:00:00Z', // 2026-01-16 in Addis
      '2026-01-14T10:00:00Z',
    ]
    const keys = toTimezoneDayKeys(timestamps, ADDIS_TZ)
    expect(keys).toEqual(['2026-01-14', '2026-01-15', '2026-01-16'])
  })

  test('drops invalid timestamps', () => {
    const keys = toTimezoneDayKeys(['invalid', '2026-01-15T10:00:00Z'], ADDIS_TZ)
    expect(keys).toHaveLength(1)
  })
})

describe('computeTimezoneStreaks', () => {
  test('empty → 0, 0', () => {
    expect(computeTimezoneStreaks([], ADDIS_TZ)).toEqual({ current: 0, longest: 0 })
  })

  test('consecutive days → streak', () => {
    const timestamps = ['2026-01-13T10:00:00Z', '2026-01-14T10:00:00Z', '2026-01-15T10:00:00Z']
    const now = new Date('2026-01-15T20:00:00Z')
    const result = computeTimezoneStreaks(timestamps, ADDIS_TZ, now)
    expect(result.current).toBe(3)
    expect(result.longest).toBe(3)
  })

  test('gap breaks streak', () => {
    const timestamps = [
      '2026-01-10T10:00:00Z',
      '2026-01-15T10:00:00Z', // 5-day gap
    ]
    const now = new Date('2026-01-15T20:00:00Z')
    const result = computeTimezoneStreaks(timestamps, ADDIS_TZ, now)
    expect(result.current).toBe(1) // only today
    expect(result.longest).toBe(1)
  })

  test('streak measured in student timezone, not UTC', () => {
    // Activity at 22:00 UTC on Jan 15 → Jan 16 in Addis.
    // Activity at 10:00 UTC on Jan 16 → Jan 16 in Addis.
    // Both are the same Addis day (Jan 16) → streak is 1, not 2.
    const timestamps = [
      '2026-01-15T22:00:00Z', // Jan 16 Addis
      '2026-01-16T10:00:00Z', // Jan 16 Addis
    ]
    const now = new Date('2026-01-16T20:00:00Z')
    const result = computeTimezoneStreaks(timestamps, ADDIS_TZ, now)
    expect(result.current).toBe(1) // same Addis day
  })
})

describe('isAtRiskInTimezone', () => {
  test('true when no activity', () => {
    expect(isAtRiskInTimezone(null, ADDIS_TZ)).toBe(true)
  })

  test('false when recent activity', () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
    expect(isAtRiskInTimezone(recent, ADDIS_TZ)).toBe(false)
  })

  test('true when 14+ days inactive', () => {
    const old = new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString() // 18 days ago
    expect(isAtRiskInTimezone(old, ADDIS_TZ)).toBe(true)
  })
})

describe('atRiskLabel', () => {
  test('null when no activity', () => {
    expect(atRiskLabel(null, ADDIS_TZ)).toBeNull()
  })

  test('null when recent activity', () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    expect(atRiskLabel(recent, ADDIS_TZ)).toBeNull()
  })

  test('names day count when at risk', () => {
    const old = new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString()
    const label = atRiskLabel(old, ADDIS_TZ)
    expect(label).toContain('No activity for')
    expect(label).toContain('days')
  })
})

describe('STREAK_HELPER_TEXT', () => {
  test('mentions student timezone', () => {
    expect(STREAK_HELPER_TEXT).toContain("student's own timezone")
  })
})
