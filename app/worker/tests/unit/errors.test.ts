/**
 * @test unit/errors
 * @description Unit tests for the worker's error classification helpers.
 */

import { describe, test, expect } from 'bun:test'

import { classifyError, safeErrorMessage } from '@/utils/errors'

describe('classifyError', () => {
  test('identifies connection errors', () => {
    expect(classifyError(new Error('ECONNREFUSED'))).toBe('connection')
    expect(classifyError(new Error('connection timeout'))).toBe('connection')
    expect(classifyError(new Error('ECONNRESET'))).toBe('connection')
    expect(classifyError(new Error('ETIMEDOUT'))).toBe('connection')
  })

  test('identifies timeouts separately', () => {
    expect(classifyError(new Error('request timeout exceeded'))).toBe('timeout')
  })

  test('falls back to unknown', () => {
    expect(classifyError(new Error('something else entirely'))).toBe('unknown')
    expect(classifyError('a string error')).toBe('unknown')
  })
})

describe('safeErrorMessage', () => {
  test('does not leak internals', () => {
    expect(safeErrorMessage(new Error('secret password exposed'))).toBe(
      'An internal error occurred',
    )
  })

  test('surfaces recognised system errors', () => {
    expect(safeErrorMessage(new Error('ECONNREFUSED'))).toContain('ECONNREFUSED')
  })

  test('never throws on a non-error value', () => {
    expect(safeErrorMessage(undefined)).toBe('An internal error occurred')
    expect(safeErrorMessage(null)).toBe('An internal error occurred')
  })
})
