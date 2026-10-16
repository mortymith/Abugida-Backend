import { describe, expect, test } from 'bun:test'
import {
  forbiddenBody,
  forbiddenRequestIdLabel,
  forbiddenTitle,
  notFoundBackLabel,
  notFoundTitle,
} from '#/components/common/common.error-pages'
import type { ForbiddenConfig, NotFoundConfig } from '#/components/common/common.error-pages'

describe('forbiddenTitle', () => {
  test('names resource when present', () => {
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
describe('notFoundTitle', () => {
  test('names resource + deleted', () => {
    const config: NotFoundConfig = { resourceName: 'course', requestId: 'r1', backLabel: 'Courses' }
    expect(notFoundTitle(config)).toContain('course')
    expect(notFoundTitle(config)).toContain('deleted')
  })
})
describe('notFoundBackLabel', () => {
  test('names back destination', () => {
    const config: NotFoundConfig = { resourceName: 'course', requestId: 'r1', backLabel: 'Courses' }
    expect(notFoundBackLabel(config)).toBe('Back to Courses')
  })
})
