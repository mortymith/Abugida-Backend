import { describe, expect, test } from 'bun:test'
import {
  CAPABILITY_LIST,
  canSaveRoleMatrix,
  isSupportCapabilityExcluded,
} from '#/features/settings/settings.capability-list'

describe('CAPABILITY_LIST', () => {
  test('includes all 22 capabilities', () => {
    expect(CAPABILITY_LIST.length).toBeGreaterThanOrEqual(20)
  })
  test('includes finance.view_revenue', () => {
    expect(CAPABILITY_LIST.some((c) => c.id === 'finance.view_revenue')).toBe(true)
  })
  test('includes students.read', () => {
    expect(CAPABILITY_LIST.some((c) => c.id === 'students.read')).toBe(true)
  })
  test('every row has all 5 role defaults', () => {
    for (const row of CAPABILITY_LIST) {
      expect(row.adminDefault).toBeDefined()
      expect(row.editorDefault).toBeDefined()
      expect(row.reviewerDefault).toBeDefined()
      expect(row.viewerDefault).toBeDefined()
      expect(row.supportDefault).toBeDefined()
    }
  })
})
describe('canSaveRoleMatrix', () => {
  test('blocked when gated course has no reviewer', () => {
    const matrix = {} as any
    matrix['course.review'] = 'denied'
    const r = canSaveRoleMatrix(matrix, true)
    expect(r.permitted).toBe(false)
    expect(r.reason).toContain('review')
  })
  test('permitted when gated course has reviewer', () => {
    const matrix = {} as any
    matrix['course.review'] = 'granted'
    expect(canSaveRoleMatrix(matrix, true).permitted).toBe(true)
  })
  test('permitted when no gated course', () => {
    const matrix = {} as any
    matrix['course.review'] = 'denied'
    expect(canSaveRoleMatrix(matrix, false).permitted).toBe(true)
  })
})
describe('isSupportCapabilityExcluded', () => {
  test('true for finance.view_revenue', () => {
    expect(isSupportCapabilityExcluded('finance.view_revenue')).toBe(true)
  })
  test('false for students.read', () => {
    expect(isSupportCapabilityExcluded('students.read')).toBe(false)
  })
})
