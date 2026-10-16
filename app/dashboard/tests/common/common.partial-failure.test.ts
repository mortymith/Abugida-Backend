import { describe, expect, test } from 'bun:test'
import {
  formatBulkPartialFailure,
  formatPartialFailure,
  hasPartialFailure,
} from '#/components/common/common.partial-failure'
import type { PartialFailureResult } from '#/components/common/common.partial-failure'

describe('formatPartialFailure', () => {
  test('all succeeded', () => {
    const result: PartialFailureResult = { succeeded: 9, failed: 0, failedItems: [] }
    expect(formatPartialFailure(result)).toBe('Saved 9 fields.')
  })
  test('mixed — names failed field', () => {
    const result: PartialFailureResult = {
      succeeded: 8,
      failed: 1,
      failedItems: [{ id: 'f1', label: 'Discount limit', error: 'exceeds max' }],
    }
    const msg = formatPartialFailure(result)
    expect(msg).toContain('8 of 9')
    expect(msg).toContain('Discount limit')
  })
})
describe('formatBulkPartialFailure', () => {
  test('all succeeded', () => {
    expect(formatBulkPartialFailure('archived', 47, 0)).toBe('47 archived')
  })
  test('mixed', () => {
    const msg = formatBulkPartialFailure('archived', 47, 3)
    expect(msg).toContain('47 archived')
    expect(msg).toContain('3 failed')
    expect(msg).toContain('Retry')
  })
})
describe('hasPartialFailure', () => {
  test('true when both > 0', () => expect(hasPartialFailure(8, 1)).toBe(true))
  test('false when no failures', () => expect(hasPartialFailure(9, 0)).toBe(false))
  test('false when no successes', () => expect(hasPartialFailure(0, 9)).toBe(false))
})
