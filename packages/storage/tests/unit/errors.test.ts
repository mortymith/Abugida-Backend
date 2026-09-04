/**
 * Unit tests for error types and classification.
 */

import { describe, test, expect } from 'bun:test'
import {
  StorageError,
  StorageNotFoundError,
  StorageAccessDeniedError,
  StorageUploadError,
  StorageDownloadError,
  StorageValidationError,
  StorageTimeoutError,
  StorageConflictError,
  StorageQuotaError,
  StorageKeyError,
  classifyError,
} from '../../src/utils/errors.ts'

describe('Error hierarchy', () => {
  test('StorageError is base class', () => {
    const err = new StorageError('test')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(StorageError)
    expect(err.name).toBe('StorageError')
  })

  test('StorageNotFoundError has correct name and key', () => {
    const err = new StorageNotFoundError('test-key')
    expect(err).toBeInstanceOf(StorageError)
    expect(err.name).toBe('StorageNotFoundError')
    expect(err.key).toBe('test-key')
    expect(err.message).toContain('test-key')
  })

  test('StorageValidationError has rule', () => {
    const err = new StorageValidationError('bad file', { rule: 'size' })
    expect(err.rule).toBe('size')
  })

  test('StorageTimeoutError has timeout', () => {
    const err = new StorageTimeoutError('timed out', { timeout: 30000 })
    expect(err.timeout).toBe(30000)
  })

  test('StorageQuotaError has limit', () => {
    const err = new StorageQuotaError('too big', { limit: 5_000_000 })
    expect(err.limit).toBe(5_000_000)
  })
})

describe('classifyError', () => {
  test('returns StorageNotFoundError for 404', () => {
    const err = classifyError(
      { name: 'Error', message: 'Not found', $metadata: { httpStatusCode: 404 } },
      'test-key',
    )
    expect(err).toBeInstanceOf(StorageNotFoundError)
  })

  test('returns StorageAccessDeniedError for 403', () => {
    const err = classifyError(
      { name: 'AccessDenied', message: 'Forbidden', $metadata: { httpStatusCode: 403 } },
      'test-key',
    )
    expect(err).toBeInstanceOf(StorageAccessDeniedError)
  })

  test('returns StorageTimeoutError for TimeoutError', () => {
    const err = classifyError({ name: 'TimeoutError', message: 'Timeout' }, 'test-key')
    expect(err).toBeInstanceOf(StorageTimeoutError)
  })

  test('returns StorageConflictError for 409', () => {
    const err = classifyError({
      name: 'Error',
      message: 'Conflict',
      $metadata: { httpStatusCode: 409 },
    })
    expect(err).toBeInstanceOf(StorageConflictError)
  })

  test('returns StorageQuotaError for 413', () => {
    const err = classifyError({
      name: 'Error',
      message: 'Too large',
      $metadata: { httpStatusCode: 413 },
    })
    expect(err).toBeInstanceOf(StorageQuotaError)
  })

  test('returns generic StorageError for unknown errors', () => {
    const err = classifyError({ name: 'UnknownError', message: 'Something broke' })
    expect(err).toBeInstanceOf(StorageError)
    expect(err).not.toBeInstanceOf(StorageNotFoundError)
  })

  test('passes through existing StorageError instances', () => {
    const original = new StorageNotFoundError('key1')
    const result = classifyError(original, 'key1')
    expect(result).toBe(original)
  })
})
