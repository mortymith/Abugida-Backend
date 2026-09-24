import { describe, expect, test } from 'bun:test'
import {
  resolveDateRange,
  resolveTrendGranularity,
} from '#/features/dashboard/schemas/dashboard.date-range.schema'

const NOW = new Date('2026-03-15T12:00:00Z')

describe('resolveDateRange', () => {
  test('7d preset spans exactly 7 days ending now', () => {
    const range = resolveDateRange({ preset: '7d' }, NOW)
    expect(range.to.getTime()).toBe(NOW.getTime())
    expect((range.to.getTime() - range.from.getTime()) / 86_400_000).toBeCloseTo(7, 5)
    expect(range.label).toBe('Last 7 days')
  })

  test('previous period has equal length immediately before the selected one', () => {
    const range = resolveDateRange({ preset: '30d' }, NOW)
    const span = range.to.getTime() - range.from.getTime()
    expect(range.prevTo.getTime()).toBe(range.from.getTime())
    expect(range.from.getTime() - range.prevFrom.getTime()).toBe(span)
  })

  test('12mo preset spans 12 months', () => {
    const range = resolveDateRange({ preset: '12mo' }, NOW)
    expect(range.from.getUTCMonth()).toBe(new Date(NOW).getUTCMonth() - 12 + 12) // 12 months back
    expect(range.from.getUTCFullYear()).toBe(2025)
  })

  test('custom range is inclusive calendar days in UTC', () => {
    const range = resolveDateRange({ from: '2026-01-01', to: '2026-01-31' }, NOW)
    expect(range.from.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    // to is exclusive: end of Jan 31 + 1ms
    expect(range.to.toISOString()).toBe('2026-02-01T00:00:00.000Z')
  })

  test('custom range takes precedence over preset', () => {
    const range = resolveDateRange({ preset: '7d', from: '2026-01-01', to: '2026-01-31' }, NOW)
    expect(range.label).not.toBe('Last 7 days')
  })

  test('inverted custom range falls back to default preset (30d)', () => {
    const range = resolveDateRange({ from: '2026-02-01', to: '2026-01-01' }, NOW)
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
