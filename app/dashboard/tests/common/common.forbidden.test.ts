import { describe, expect, test } from 'bun:test'
import {
  forbiddenBody,
  forbiddenRequestIdLabel,
  forbiddenTitle,
} from '#/components/common/common.forbidden'
import type { ForbiddenConfig } from '#/components/common/common.forbidden'

describe('forbiddenTitle', () => {
  test('names the resource when present', () => {
    const config: ForbiddenConfig = { resourceName: 'TOEFL Complete', requestId: 'req-123' }
    expect(forbiddenTitle(config)).toContain('TOEFL Complete')
  })
  test('generic when no resource', () => {
    expect(forbiddenTitle({ resourceName: null, requestId: null })).toContain("don't have access")
  })
})
describe('forbiddenBody', () => {
  test('mentions Ask an Admin', () => {
    expect(forbiddenBody({ resourceName: null, requestId: null })).toContain('Ask an Admin')
  })
})
describe('forbiddenRequestIdLabel', () => {
  test('includes request ID', () => {
    expect(forbiddenRequestIdLabel({ resourceName: null, requestId: 'req-456' })).toBe(
      'Request ID: req-456',
    )
  })
  test('null when no request ID', () => {
    expect(forbiddenRequestIdLabel({ resourceName: null, requestId: null })).toBeNull()
  })
})
