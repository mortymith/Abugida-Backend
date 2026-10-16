import { describe, expect, test } from 'bun:test'
import {
  resolveDateRange,
  resolveTrendGranularity,
  startOfReportingDay,
} from '#/features/dashboard/schemas/dashboard.date-range.schema'

// 2026-03-15 15:00 UTC = 2026-03-15 18:00 EAT.
const NOW = new Date('2026-03-15T15:00:00Z')
const EAT_OFFSET = 3 * 60 * 60 * 1000

describe('resolveDateRange', () => {
  test('day boundaries are Africa/Addis_Ababa midnights', () => {
    // 00:00 EAT on Mar 15 is 21:00 UTC on Mar 14.
    expect(startOfReportingDay(NOW).toISOString()).toBe('2026-03-14T21:00:00.000Z')
  })

  test('7d preset spans 7 Addis days ending today', () => {
    const range = resolveDateRange({ preset: '7d' }, NOW)
    expect((range.to.getTime() - range.from.getTime()) / 86_400_000).toBe(7)
    expect(range.to.toISOString()).toBe('2026-03-15T21:00:00.000Z')
    expect(range.label).toBe('Last 7 days')
  })

  test('previous period has equal length immediately before the selected one', () => {
    const range = resolveDateRange({ preset: '30d' }, NOW)
    const span = range.to.getTime() - range.from.getTime()
    expect(range.prevTo.getTime()).toBe(range.from.getTime())
    expect(range.from.getTime() - range.prevFrom.getTime()).toBe(span)
    expect(range.comparisonLabel).toBe('previous 30 days')
  })

  test('12mo preset spans 12 months', () => {
    const range = resolveDateRange({ preset: '12mo' }, NOW)
    expect(range.from.toISOString()).toBe('2025-03-14T21:00:00.000Z')
    expect(range.label).toBe('Last 12 months')
  })

  test('this month starts on the first of the current Addis month', () => {
    const range = resolveDateRange({ preset: 'thisMonth' }, NOW)
    expect(range.from.toISOString()).toBe('2026-02-28T21:00:00.000Z')
    expect(range.label).toBe('This month')
  })

  test('last month is a closed calendar month', () => {
    const range = resolveDateRange({ preset: 'lastMonth' }, NOW)
    // Feb 1 00:00 EAT → Feb 1 00:00 EAT, i.e. the month before March.
    expect(range.from.toISOString()).toBe('2026-01-31T21:00:00.000Z')
    expect(range.to.toISOString()).toBe('2026-02-28T21:00:00.000Z')
    expect(range.label).toBe('Last month')
  })

  test('all time starts at the workspace earliest course date', () => {
    const range = resolveDateRange({ preset: 'allTime' }, NOW, { allTimeFrom: '2025-06-10' })
    expect(range.from.toISOString()).toBe('2025-06-09T21:00:00.000Z')
    expect(range.to.getTime()).toBe(resolveDateRange({ preset: '7d' }, NOW).to.getTime())
  })

  test('a range ending today says the last day is still in progress', () => {
    const range = resolveDateRange({ preset: '30d' }, NOW)
    expect(range.partialDayNote).toBe('Mar 15 is still in progress.')
  })

  test('a closed past range is not labelled in progress', () => {
    const range = resolveDateRange({ from: '2026-01-01', to: '2026-01-31' }, NOW)
    expect(range.partialDayNote).toBeUndefined()
  })

  test('custom range is inclusive Addis calendar days with an exclusive end', () => {
    const range = resolveDateRange({ from: '2026-01-01', to: '2026-01-31' }, NOW)
    expect(range.from.getTime()).toBe(new Date('2026-01-01T00:00:00Z').getTime() - EAT_OFFSET)
    expect(range.to.getTime()).toBe(new Date('2026-02-01T00:00:00Z').getTime() - EAT_OFFSET)
    expect(range.comparisonLabel).toBe('previous 31 days')
  })

  test('custom range takes precedence over preset', () => {
    const range = resolveDateRange({ preset: '7d', from: '2026-01-01', to: '2026-01-31' }, NOW)
    expect(range.label).not.toBe('Last 7 days')
  })

  test('inverted custom range falls back to default preset (30d)', () => {
    const range = resolveDateRange({ from: '2026-02-01', to: '2026-01-01' }, NOW)
    expect(range.label).toBe('Last 30 days')
  })

  test('a future end date falls back to the default preset', () => {
    const range = resolveDateRange({ from: '2026-01-01', to: '2027-01-01' }, NOW)
    expect(range.label).toBe('Last 30 days')
  })

  test('garbage dates fall back to default preset', () => {
    const range = resolveDateRange({ from: 'not-a-date', to: '2026-01-01' }, NOW)
    expect(range.label).toBe('Last 30 days')
  })

  test('missing input defaults to 30d', () => {
    const range = resolveDateRange(undefined, NOW)
    expect(range.label).toBe('Last 30 days')
  })

  test('custom range previous period equals its own length', () => {
    const range = resolveDateRange({ from: '2026-01-10', to: '2026-01-12' }, NOW)
    const span = range.to.getTime() - range.from.getTime()
    expect(range.prevTo.getTime()).toBe(range.from.getTime())
    expect(range.from.getTime() - range.prevFrom.getTime()).toBe(span)
  })

  test('a 12-month comparison basis overrides the equal-length period', () => {
    const range = resolveDateRange({ preset: '30d' }, NOW, { compareMonths: 12 })
    expect(range.comparisonLabel).toBe('previous 12 months')
    expect(range.prevTo.getTime()).toBe(range.from.getTime())
    expect(range.from.getTime() - range.prevFrom.getTime()).toBe(365 * 86_400_000)
  })
})

describe('resolveTrendGranularity', () => {
  test('day for short ranges', () => {
    const range = resolveDateRange({ preset: '30d' }, NOW)
    expect(resolveTrendGranularity(range)).toBe('day')
  })

  test('week for medium ranges', () => {
    const range = resolveDateRange({ preset: '90d' }, NOW)
    expect(resolveTrendGranularity(range)).toBe('week')
  })

  test('month for long ranges', () => {
    const range = resolveDateRange({ preset: '12mo' }, NOW)
    expect(resolveTrendGranularity(range)).toBe('month')
  })
})
