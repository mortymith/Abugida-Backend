import { describe, expect, test } from 'bun:test'
import {
  countRealStudents,
  excludePreviewAndTest,
  isPreviewOrTest,
} from '#/features/analytics/analytics.identity-exclusion'
import type { ExcludableRow } from '#/features/analytics/analytics.identity-exclusion'

const real: ExcludableRow = { isTest: false, enrollmentSource: 'purchase' }
const testUser: ExcludableRow = { isTest: true, enrollmentSource: 'admin_grant' }
const preview: ExcludableRow = { isTest: false, enrollmentSource: 'preview' }

describe('isPreviewOrTest', () => {
  test('false for real student', () => {
    expect(isPreviewOrTest(real)).toBe(false)
  })
  test('true for test user', () => {
    expect(isPreviewOrTest(testUser)).toBe(true)
  })
  test('true for preview enrollment', () => {
    expect(isPreviewOrTest(preview)).toBe(true)
  })
})

describe('excludePreviewAndTest', () => {
  test('filters out test and preview', () => {
    const rows = [real, testUser, preview, real]
    const filtered = excludePreviewAndTest(rows)
    expect(filtered).toHaveLength(2)
    expect(filtered.every((r) => !isPreviewOrTest(r))).toBe(true)
  })
  test('empty array returns empty', () => {
    expect(excludePreviewAndTest([])).toEqual([])
  })
})

describe('countRealStudents', () => {
  test('counts only real students', () => {
    const rows = [real, testUser, preview, real, real]
    expect(countRealStudents(rows)).toBe(3)
  })
  test('0 for all-preview array', () => {
    expect(countRealStudents([preview, testUser])).toBe(0)
  })
})
