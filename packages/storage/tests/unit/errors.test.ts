/**
 * Unit tests for error types and classification.
 */

import { describe, it, expect } from 'vitest'
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
  it('StorageError is base class', () => {
    const err = new StorageError('test')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(StorageError)
    expect(err.name).toBe('StorageError')
  })

  it('StorageNotFoundError has correct name and key', () => {
    const err = new StorageNotFoundError('test-key')
    expect(err).toBeInstanceOf(StorageError)
    expect(err.name).toBe('StorageNotFoundError')
    expect(err.key).toBe('test-key')
    expect(err.message).toContain('test-key')
  })

  it('StorageValidationError has rule', () => {
    const err = new StorageValidationError('bad file', { rule: 'size' })
    expect(err.rule).toBe('size')
  })

  it('StorageTimeoutError has timeout', () => {
    const err = new StorageTimeoutError('timed out', { timeout: 30000 })
    expect(err.timeout).toBe(30000)
  })

  it('StorageQuotaError has limit', () => {
    const err = new StorageQuotaError('too big', { limit: 5_000_000 })
    expect(err.limit).toBe(5_000_000)
  })
})

describe('classifyError', () => {
  it('returns StorageNotFoundError for 404', () => {
    const err = classifyError(
      { name: 'Error', message: 'Not found', $metadata: { httpStatusCode: 404 } },
      'test-key',
    )
    expect(err).toBeInstanceOf(StorageNotFoundError)
  })

  it('returns StorageAccessDeniedError for 403', () => {
    const err = classifyError(
      { name: 'AccessDenied', message: 'Forbidden', $metadata: { httpStatusCode: 403 } },
      'test-key',
    )
    expect(err).toBeInstanceOf(StorageAccessDeniedError)
  })

  it('returns StorageTimeoutError for TimeoutError', () => {
    const err = classifyError({ name: 'TimeoutError', message: 'Timeout' }, 'test-key')
    expect(err).toBeInstanceOf(StorageTimeoutError)
  })

  it('returns StorageConflictError for 409', () => {
    const err = classifyError({
      name: 'Error',
      message: 'Conflict',
      $metadata: { httpStatusCode: 409 },
    })
    expect(err).toBeInstanceOf(StorageConflictError)
  })

  it('returns StorageQuotaError for 413', () => {
    const err = classifyError({
      name: 'Error',
      message: 'Too large',
      $metadata: { httpStatusCode: 413 },
    })
    expect(err).toBeInstanceOf(StorageQuotaError)
  })

  it('returns generic StorageError for unknown errors', () => {
    const err = classifyError({ name: 'UnknownError', message: 'Something broke' })
    expect(err).toBeInstanceOf(StorageError)
    expect(err).not.toBeInstanceOf(StorageNotFoundError)
  })

  it('passes through existing StorageError instances', () => {
    const original = new StorageNotFoundError('key1')
    const result = classifyError(original, 'key1')
    expect(result).toBe(original)
  })
})
