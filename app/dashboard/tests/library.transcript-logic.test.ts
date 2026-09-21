import { describe, expect, test } from 'bun:test'
import {
  formatClock,
  longLineWarnings,
  parseClock,
  snapToFreeGap,
  validateMonotonic,
} from '#/features/library/library.transcript-logic'

function segment(index: number, startMs: number, endMs: number) {
  return { segmentIndex: index, startMs, endMs }
}

describe('transcript segment rules (spec 05 S-3.6)', () => {
  test('accepts monotonic, non-overlapping segments', () => {
    const issues = validateMonotonic([segment(0, 0, 2000), segment(1, 2000, 4000)])
    expect(issues).toEqual([])
  })

  test('flags overlaps and inverted spans with the offending index', () => {
    const issues = validateMonotonic([
      segment(0, 0, 2000),
      segment(1, 1000, 4000),
      segment(2, 500, 300),
    ])
    expect(issues).toHaveLength(3)
    expect(
      issues.some((issue) => issue.segmentIndex === 1 && issue.message.includes('overlaps')),
    ).toBe(true)
    expect(
      issues.some((issue) => issue.segmentIndex === 2 && issue.message.includes('after its start')),
    ).toBe(true)
  })

  test('snapToFreeGap keeps valid edits untouched', () => {
    const segments = [segment(0, 0, 1000), segment(1, 2000, 3000)]
    const snapped = snapToFreeGap(segments, 1, 2100, 3100)
    expect(snapped).toEqual({ startMs: 2100, endMs: 3100 })
  })

  test('snaps an overlapping edit back to the previous end', () => {
    const segments = [segment(0, 0, 2000), segment(1, 4000, 6000), segment(2, 8000, 10_000)]
    // Editing segment 1 so it starts inside segment 0's span.
    const snapped = snapToFreeGap(segments, 1, 1500, 4000)
    expect(snapped).not.toBeNull()
    expect(snapped?.startMs).toBeGreaterThanOrEqual(2000)
    expect(snapped?.endMs).toBeLessThanOrEqual(8000)
  })

  test('shrinks into the gap when the end would overlap the next segment', () => {
    const segments = [segment(0, 0, 2000), segment(1, 6000, 8000), segment(2, 10_000, 12_000)]
    const snapped = snapToFreeGap(segments, 1, 3000, 11_000)
    expect(snapped?.startMs).toBeGreaterThanOrEqual(2000)
    expect(snapped?.endMs).toBe(10_000)
  })

  test('returns null when there is no room at all', () => {
    const segments = [segment(0, 0, 10_000), segment(1, 10_000, 20_000), segment(2, 30_000, 31_000)]
    // Segment 2 tries to live inside segment 0's span — no free gap exists.
    const snapped = snapToFreeGap(segments, 2, 4000, 6000)
    expect(snapped).toBeNull()
  })

  test('long-line warnings flag >42 chars/line and >2 lines', () => {
    const long = 'x'.repeat(43)
    const warnings = longLineWarnings([
      { segmentIndex: 0, text: 'short text' },
      { segmentIndex: 1, text: long },
      { segmentIndex: 2, text: 'one\ntwo\nthree' },
    ])
    expect(warnings).toHaveLength(2)
    expect(warnings[0]?.segmentIndex).toBe(1)
    expect(warnings[1]?.message).toContain('more than 2 lines')
  })

  test('parseClock handles m:ss and h:mm:ss.s', () => {
    expect(parseClock('01:23')).toBe(83_000)
    expect(parseClock('1:02:03')).toBe(3_723_000)
    expect(parseClock('0:04.5')).toBe(4500)
    expect(parseClock('nope')).toBeNull()
    expect(parseClock('')).toBeNull()
  })

  test('formatClock renders m:ss past the hour boundary', () => {
    expect(formatClock(83_000)).toBe('01:23')
    expect(formatClock(3_723_000)).toBe('1:02:03')
  })
})
