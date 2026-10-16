import { describe, expect, test } from 'bun:test'
import {
  computeDelta,
  computePeriodComparison,
  computePreviousPeriod,
  isPartialWindowComparison,
  partialWindowWarning,
} from '#/features/analytics/analytics.period-compare'

const sep1 = new Date('2026-09-01T00:00:00Z')
const sep14 = new Date('2026-09-14T00:00:00Z')
const aug31 = new Date('2026-08-31T00:00:00Z')
const jul18 = new Date('2026-07-18T00:00:00Z')
const jul31 = new Date('2026-07-31T00:00:00Z')

describe('computePreviousPeriod', () => {
  test('previous period ends the day before current starts', () => {
    const prev = computePreviousPeriod({ start: sep1, end: sep14 })
    expect(prev.end.getTime()).toBe(aug31.getTime())
  })
  test('previous period has the same length', () => {
    const current = { start: sep1, end: sep14 }
    const prev = computePreviousPeriod(current)
    const currentLen = current.end.getTime() - current.start.getTime()
    const prevLen = prev.end.getTime() - prev.start.getTime()
    expect(prevLen).toBe(currentLen)
  })
})

describe('isPartialWindowComparison', () => {
  test('true when different lengths', () => {
    expect(
      isPartialWindowComparison({ start: sep1, end: sep14 }, { start: jul18, end: jul31 }),
    ).toBe(true)
  })
  test('false when same length and same start weekday', () => {
    // Sep 1–14 (14 days) vs Aug 18–31 (14 days, same weekday start)
    const aug18 = new Date('2026-08-18T00:00:00Z')
    const aug31b = new Date('2026-08-31T00:00:00Z')
    // Sep 1 2026 is a Tuesday; Aug 18 2026 is a Tuesday → not partial
    expect(
      isPartialWindowComparison({ start: sep1, end: sep14 }, { start: aug18, end: aug31b }),
    ).toBe(false)
  })
})

describe('partialWindowWarning', () => {
  test('null when not partial', () => {
    const aug18 = new Date('2026-08-18T00:00:00Z')
    const aug31b = new Date('2026-08-31T00:00:00Z')
    expect(
      partialWindowWarning({ start: sep1, end: sep14 }, { start: aug18, end: aug31b }),
    ).toBeNull()
  })
  test('warning text when partial', () => {
    const warning = partialWindowWarning({ start: sep1, end: sep14 }, { start: jul18, end: jul31 })
    expect(warning).toContain('indicative')
    expect(warning).toContain('different lengths')
  })
})

describe('computePeriodComparison', () => {
  test('returns current, previous, partial flag, warning', () => {
    const result = computePeriodComparison({ start: sep1, end: sep14 })
    expect(result.current.start).toEqual(sep1)
    expect(result.previous.end.getTime()).toBe(aug31.getTime())
    expect(result.isPartial).toBeDefined()
  })
})

describe('computeDelta', () => {
  test('positive delta', () => {
    const result = computeDelta(110, 100)
    expect(result.value).toBe(10)
    expect(result.label).toBe('+10%')
  })
  test('negative delta', () => {
    const result = computeDelta(90, 100)
    expect(result.value).toBe(-10)
    expect(result.label).toBe('-10%')
  })
  test('zero previous → +∞ when current > 0', () => {
    const result = computeDelta(50, 0)
    expect(result.label).toBe('+∞')
  })
})
