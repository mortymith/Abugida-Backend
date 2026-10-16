import { describe, expect, test } from 'bun:test'
import { ANALYTICS_TIMEZONE } from '#/features/analytics/analytics.metric-dictionary'
import {
  dayKeyInTz,
  daysBetweenInTz,
  isInRange,
  startOfDayInTz,
  weekdayInTz,
} from '#/features/analytics/analytics.timezone-math'

describe('dayKeyInTz', () => {
  test('returns YYYY-MM-DD in Addis timezone', () => {
    // 2026-01-15T22:00:00Z is 2026-01-16 in Addis (UTC+3)
    expect(dayKeyInTz(new Date('2026-01-15T22:00:00Z'))).toBe('2026-01-16')
  })
  test('returns same day for early UTC time', () => {
    expect(dayKeyInTz(new Date('2026-01-15T10:00:00Z'))).toBe('2026-01-15')
  })
  test('default timezone is Africa/Addis_Ababa', () => {
    expect(ANALYTICS_TIMEZONE).toBe('Africa/Addis_Ababa')
  })
})

describe('weekdayInTz', () => {
  test('returns ISO weekday (1=Mon, 7=Sun)', () => {
    // 2026-01-15 is a Thursday in UTC; also Thursday in Addis
    expect(weekdayInTz(new Date('2026-01-15T10:00:00Z'))).toBe(4)
  })
  test('weekday changes at EAT midnight, not UTC midnight', () => {
    // 2026-01-15T22:00:00Z is 2026-01-16 (Friday) in Addis
    expect(weekdayInTz(new Date('2026-01-15T22:00:00Z'))).toBe(5)
  })
})

describe('startOfDayInTz', () => {
  test('returns EAT midnight as UTC', () => {
    // 2026-01-15T22:00:00Z is 2026-01-16 01:00 in Addis
    // Start of that EAT day (2026-01-16 00:00 EAT) = 2026-01-15T21:00:00Z
    const start = startOfDayInTz(new Date('2026-01-15T22:00:00Z'))
    expect(start.toISOString()).toBe('2026-01-15T21:00:00.000Z')
  })
  test('start of a UTC-midnight day in EAT is the previous day 21:00 UTC', () => {
    const start = startOfDayInTz(new Date('2026-01-15T00:00:00Z'))
    expect(start.toISOString()).toBe('2026-01-14T21:00:00.000Z')
  })
})

describe('isInRange', () => {
  test('true when within range', () => {
    expect(
      isInRange(
        new Date('2026-01-15T12:00:00Z'),
        new Date('2026-01-01T00:00:00Z'),
        new Date('2026-01-31T00:00:00Z'),
      ),
    ).toBe(true)
  })
  test('false before range', () => {
    expect(
      isInRange(
        new Date('2025-12-31T00:00:00Z'),
        new Date('2026-01-01T00:00:00Z'),
        new Date('2026-01-31T00:00:00Z'),
      ),
    ).toBe(false)
  })
  test('false at end (half-open)', () => {
    expect(
      isInRange(
        new Date('2026-01-31T00:00:00Z'),
        new Date('2026-01-01T00:00:00Z'),
        new Date('2026-01-31T00:00:00Z'),
      ),
    ).toBe(false)
  })
})

describe('daysBetweenInTz', () => {
  test('counts whole EAT days', () => {
    const earlier = new Date('2026-01-10T10:00:00Z')
    const later = new Date('2026-01-15T10:00:00Z')
    expect(daysBetweenInTz(earlier, later)).toBe(5)
  })
})
