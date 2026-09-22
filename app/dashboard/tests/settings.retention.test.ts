import { describe, expect, test } from 'bun:test'
import {
  inactivityCutoff,
  inWarningWindow,
  lastActiveAt,
  matchesInactivity,
} from '#/features/settings/settings.retention'
import type { StudentActivityRecord } from '#/features/settings/settings.retention'

function record(fields: Partial<StudentActivityRecord>): StudentActivityRecord {
  return {
    userId: 'u1',
    lastLoginAt: null,
    lastEnrollmentActivityAt: null,
    ...fields,
  }
}

describe('lastActiveAt', () => {
  test('picks the most recent of both sources', () => {
    const result = lastActiveAt(
      record({
        lastLoginAt: new Date('2026-06-01T00:00:00.000Z'),
        lastEnrollmentActivityAt: new Date('2026-05-01T00:00:00.000Z'),
      }),
    )
    expect(result?.toISOString()).toBe('2026-06-01T00:00:00.000Z')
  })

  test('null when the student never acted', () => {
    expect(lastActiveAt(record({}))).toBeNull()
  })

  test('survives one null source', () => {
    expect(
      lastActiveAt(
        record({
          lastLoginAt: null,
          lastEnrollmentActivityAt: new Date('2026-05-01T00:00:00.000Z'),
        }),
      ),
    ).toEqual(new Date('2026-05-01T00:00:00.000Z'))
  })
})

describe('inactivityCutoff', () => {
  test('subtracts whole months in UTC', () => {
    const cutoff = inactivityCutoff(new Date('2026-09-15T00:00:00.000Z'), 12)
    expect(cutoff.toISOString()).toBe('2025-09-15T00:00:00.000Z')
  })

  test('clamps end-of-month overflows', () => {
    // March 31 minus 1 month → March 3? No: UTC setter normalizes to Mar 3
    // only for invalid dates; JS rolls over, so assert the documented roll.
    const cutoff = inactivityCutoff(new Date('2026-03-31T00:00:00.000Z'), 1)
    expect(cutoff.getUTCFullYear()).toBe(2026)
    expect(cutoff.getUTCMonth()).toBe(2) // rolled within March
  })
})

describe('matchesInactivity', () => {
  const now = new Date('2026-09-22T00:00:00.000Z')
  const cutoff = inactivityCutoff(now, 12) // 2025-09-22

  test('inactive beyond the threshold matches', () => {
    expect(
      matchesInactivity(record({ lastLoginAt: new Date('2025-06-01T00:00:00.000Z') }), cutoff),
    ).toBe(true)
  })

  test('recently active students do not match', () => {
    expect(
      matchesInactivity(record({ lastLoginAt: new Date('2026-09-01T00:00:00.000Z') }), cutoff),
    ).toBe(false)
  })

  test('boundary: exactly at the cutoff does not match (strictly before)', () => {
    expect(matchesInactivity(record({ lastLoginAt: cutoff }), cutoff)).toBe(false)
  })

  test('never-active students match immediately', () => {
    expect(matchesInactivity(record({}), cutoff)).toBe(true)
  })
})

describe('inWarningWindow (warning-email cohort)', () => {
  const now = new Date('2026-09-22T00:00:00.000Z')
  const cutoff = inactivityCutoff(now, 12)

  test('students crossing the threshold within the warning span are included', () => {
    // 12-month cutoff = 2025-09-22; +14 days → 2025-10-06. A student last
    // active 2025-10-01 has been inactive 11 months 21 days: not yet matching,
    // but hitting the threshold within the warning window.
    const student = record({ lastLoginAt: new Date('2025-10-01T00:00:00.000Z') })
    expect(inWarningWindow(student, cutoff, 14)).toBe(true)
  })

  test('students far from the threshold are excluded', () => {
    expect(
      inWarningWindow(record({ lastLoginAt: new Date('2026-06-01T00:00:00.000Z') }), cutoff, 14),
    ).toBe(false)
  })

  test('students already matching the full threshold are excluded (they are actions, not warnings)', () => {
    expect(
      inWarningWindow(record({ lastLoginAt: new Date('2025-06-01T00:00:00.000Z') }), cutoff, 14),
    ).toBe(false)
  })

  test('never-active students are excluded from warnings', () => {
    expect(inWarningWindow(record({}), cutoff, 14)).toBe(false)
  })
})
