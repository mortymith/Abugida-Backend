/**
 * Unit tests for utility modules.
 */

import { describe, test, expect } from 'bun:test'
import { calculateDelay, withRetry, sleep } from '../../src/utils/retry.ts'
import {
  formatFileSize,
  getExtension,
  extensionToMime,
  keyToMime,
  normalizeKey,
  joinKey,
} from '../../src/utils/format.ts'
import { StorageValidationError, StorageQuotaError } from '../../src/utils/errors.ts'
import { validateSize, assertSize, SIZE_LIMITS, validateQuota } from '../../src/validation/size.ts'
import { validateMimeType, assertMimeType, MIME_TYPES } from '../../src/validation/mime.ts'
import {
  validateExtension,
  assertExtension,
  extractExtension,
  EXTENSIONS,
} from '../../src/validation/extension.ts'

describe('Retry utilities', () => {
  test('calculateDelay returns fixed delay for fixed strategy', () => {
    expect(calculateDelay(0, 'fixed', 200, 10_000)).toBe(200)
    expect(calculateDelay(5, 'fixed', 200, 10_000)).toBe(200)
  })

  test('calculateDelay returns exponential delay', () => {
    const d0 = calculateDelay(0, 'exponential', 200, 10_000)
    const d1 = calculateDelay(1, 'exponential', 200, 10_000)
    const d2 = calculateDelay(2, 'exponential', 200, 10_000)
    expect(d0).toBe(200) // 200 * 2^0
    expect(d1).toBe(400) // 200 * 2^1
    expect(d2).toBe(800) // 200 * 2^2
  })

  test('calculateDelay caps at maxDelay', () => {
    const delay = calculateDelay(10, 'exponential', 200, 1000)
    expect(delay).toBe(1000)
  })

  test('withRetry returns result on first success', async () => {
    const result = await withRetry(() => Promise.resolve(42), { maxAttempts: 3, backoff: 'fixed' })
    expect(result).toBe(42)
  })

  test('withRetry retries on failure', async () => {
    let attempts = 0
    const result = await withRetry(
      () => {
        attempts++
        if (attempts < 3) throw new Error('fail')
        return Promise.resolve('ok')
      },
      { maxAttempts: 3, backoff: 'fixed', baseDelay: 10 },
    )
    expect(result).toBe('ok')
    expect(attempts).toBe(3)
  })

  test('withRetry throws after max attempts', async () => {
    await expect(
      withRetry(() => Promise.reject(new Error('always fail')), {
        maxAttempts: 2,
        backoff: 'fixed',
        baseDelay: 10,
      }),
    ).rejects.toThrow('always fail')
  })
})

describe('Format utilities', () => {
  test('formatFileSize formats bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(1023)).toBe('1023 B')
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB')
  })

  test('getExtension extracts extension', () => {
    expect(getExtension('file.txt')).toBe('txt')
    expect(getExtension('image.webp')).toBe('webp')
    expect(getExtension('noext')).toBe('')
    expect(getExtension('path/to/file.mp4')).toBe('mp4')
  })

  test('extensionToMime returns correct MIME types', () => {
    expect(extensionToMime('mp4')).toBe('video/mp4')
    expect(extensionToMime('webp')).toBe('image/webp')
    expect(extensionToMime('pdf')).toBe('application/pdf')
    expect(extensionToMime('unknown')).toBe('application/octet-stream')
  })

  test('keyToMime derives MIME from key', () => {
    expect(keyToMime('courses/123/videos/vid.mp4')).toBe('video/mp4')
  })

  test('normalizeKey strips leading slashes and collapses repeats', () => {
    expect(normalizeKey('/foo//bar/')).toBe('foo/bar/')
    expect(normalizeKey('foo/bar')).toBe('foo/bar')
  })

  test('joinKey joins segments', () => {
    expect(joinKey('a', 'b', 'c')).toBe('a/b/c')
  })
})

describe('Size validation', () => {
  test('validateSize passes within limit (bytes)', () => {
    expect(() => validateSize(1000, 2000)).not.toThrow()
  })

  test('validateSize throws StorageQuotaError when exceeded', () => {
    expect(() => validateSize(10_000_000, 5_000_000)).toThrow(StorageQuotaError)
  })

  test('assertSize narrows a valid number', () => {
    const value: unknown = 1024
    expect(() => assertSize(value, 5000)).not.toThrow()
  })

  test('assertSize rejects non-numbers', () => {
    expect(() => assertSize('1024', 5000)).toThrow(StorageQuotaError)
    expect(() => assertSize(-1, 5000)).toThrow(StorageQuotaError)
  })

  test('assertSize rejects oversized values', () => {
    expect(() => assertSize(10_000_000, 5_000_000)).toThrow(StorageQuotaError)
  })

  test('validateQuota checks MB limit', () => {
    expect(() => validateQuota(3 * 1024 * 1024, 5)).not.toThrow()
    expect(() => validateQuota(10 * 1024 * 1024, 5)).toThrow()
  })

  test('SIZE_LIMITS has expected values', () => {
    expect(SIZE_LIMITS.AVATAR).toBe(5 * 1024 * 1024)
    expect(SIZE_LIMITS.S3_MAX).toBe(5 * 1024 * 1024 * 1024)
  })
})

describe('MIME type validation', () => {
  test('validateMimeType accepts allowed types and wildcards', () => {
    expect(() => validateMimeType('image/jpeg', ['image/*', 'video/mp4'])).not.toThrow()
    expect(() => validateMimeType('image/png', MIME_TYPES.IMAGES)).not.toThrow()
  })

  test('validateMimeType rejects disallowed types', () => {
    expect(() => validateMimeType('text/html', ['image/*'])).toThrow(StorageValidationError)
    expect(() => validateMimeType('text/html', MIME_TYPES.IMAGES)).toThrow()
  })

  test('assertMimeType narrows a valid string', () => {
    const value: unknown = 'image/png'
    expect(() => assertMimeType(value, MIME_TYPES.IMAGES)).not.toThrow()
  })

  test('assertMimeType rejects non-strings and disallowed types', () => {
    expect(() => assertMimeType(undefined, MIME_TYPES.IMAGES)).toThrow(StorageValidationError)
    expect(() => assertMimeType('', MIME_TYPES.IMAGES)).toThrow(StorageValidationError)
    expect(() => assertMimeType('text/html', MIME_TYPES.IMAGES)).toThrow(StorageValidationError)
  })
})

describe('Extension validation', () => {
  test('validateExtension accepts allowed extensions', () => {
    expect(() => validateExtension('mp4', ['mp4', 'webm'])).not.toThrow()
    expect(() => validateExtension('mp4', EXTENSIONS.VIDEOS)).not.toThrow()
  })

  test('validateExtension rejects disallowed extensions', () => {
    expect(() => validateExtension('exe', ['mp4', 'webm'])).toThrow(StorageValidationError)
    expect(() => validateExtension('exe', EXTENSIONS.VIDEOS)).toThrow()
  })

  test('assertExtension narrows a valid string', () => {
    const value: unknown = 'mp4'
    expect(() => assertExtension(value, EXTENSIONS.VIDEOS)).not.toThrow()
  })

  test('assertExtension rejects non-strings and disallowed extensions', () => {
    expect(() => assertExtension(null, EXTENSIONS.VIDEOS)).toThrow(StorageValidationError)
    expect(() => assertExtension('exe', EXTENSIONS.VIDEOS)).toThrow(StorageValidationError)
  })

  test('extractExtension handles keys and missing extensions', () => {
    expect(extractExtension('path/to/file.MP4')).toBe('mp4')
    expect(extractExtension('noext')).toBe('')
    expect(extractExtension('trailing.')).toBe('')
  })
})
