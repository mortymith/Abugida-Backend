import { describe, expect, test } from 'bun:test'
import { computeStreaks, isAtRisk, toUtcDayKeys } from '#/features/students/students.streak'

describe('toUtcDayKeys', () => {
  test('deduplicates and sorts days', () => {
    const keys = toUtcDayKeys([
      '2026-09-03T10:00:00.000Z',
      '2026-09-01T22:00:00.000Z',
      '2026-09-03T05:00:00.000Z',
    ])
    expect(keys).toEqual(['2026-09-01', '2026-09-03'])
  })

  test('drops invalid timestamps', () => {
    expect(toUtcDayKeys(['not-a-date', '2026-09-01T00:00:00.000Z'])).toEqual(['2026-09-01'])
  })
})

describe('computeStreaks', () => {
  test('empty activity → zero streaks', () => {
    expect(computeStreaks([], '2026-09-10')).toEqual({ current: 0, longest: 0 })
  })

  test('today-only activity → current 1', () => {
    expect(computeStreaks(['2026-09-10'], '2026-09-10')).toEqual({ current: 1, longest: 1 })
  })

  test('yesterday-only activity keeps the streak alive', () => {
    expect(computeStreaks(['2026-09-09'], '2026-09-10')).toEqual({ current: 1, longest: 1 })
  })

  test('gap larger than a day breaks the current streak', () => {
    const { current, longest } = computeStreaks(
      ['2026-09-01', '2026-09-02', '2026-09-05'],
      '2026-09-10',
    )
    expect(current).toBe(0)
    expect(longest).toBe(2)
  })

  test('consecutive tail run counts the full current streak', () => {
    const { current, longest } = computeStreaks(
      ['2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'],
      '2026-09-10',
    )
    expect(current).toBe(5)
    expect(longest).toBe(5)
  })

  test('longest run may precede the current one', () => {
    const { current, longest } = computeStreaks(
      ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-09', '2026-09-10'],
      '2026-09-10',
    )
    expect(current).toBe(2)
    expect(longest).toBe(3)
  })
})

describe('isAtRisk', () => {
  test('inactive 14+ days flags at-risk', () => {
    expect(isAtRisk('2026-08-25T00:00:00.000Z', '2026-09-10')).toBe(true)
  })

  test('recent activity is not at-risk', () => {
    expect(isAtRisk('2026-09-09T00:00:00.000Z', '2026-09-10')).toBe(false)
  })

  test('no activity at all flags at-risk', () => {
    expect(isAtRisk(null, '2026-09-10')).toBe(true)
  })
})
