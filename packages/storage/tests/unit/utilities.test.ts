/**
 * Unit tests for utility modules.
 */

import { describe, it, expect } from 'vitest'
import { calculateDelay, withRetry, sleep } from '../../src/utils/retry.ts'
import {
  formatFileSize,
  getExtension,
  extensionToMime,
  keyToMime,
  normaliseKey,
  joinKey,
  maskSensitive,
} from '../../src/utils/format.ts'
import {
  validateSize,
  validateMimeType,
  validateExtension,
  validateCustom,
} from '../../src/utils/validators.ts'
import { StorageValidationError } from '../../src/utils/errors.ts'
import {
  validateSize as validateSizeValidation,
  SIZE_LIMITS,
  validateQuota,
} from '../../src/validation/size.ts'
import {
  validateMimeType as validateMimeTypeValidation,
  MIME_TYPES,
} from '../../src/validation/mime.ts'
import {
  validateExtension as validateExtensionValidation,
  EXTENSIONS,
} from '../../src/validation/extension.ts'

describe('Retry utilities', () => {
  it('calculateDelay returns fixed delay for fixed strategy', () => {
    expect(calculateDelay(0, 'fixed', 200, 10_000)).toBe(200)
    expect(calculateDelay(5, 'fixed', 200, 10_000)).toBe(200)
  })

  it('calculateDelay returns exponential delay', () => {
    const d0 = calculateDelay(0, 'exponential', 200, 10_000)
    const d1 = calculateDelay(1, 'exponential', 200, 10_000)
    const d2 = calculateDelay(2, 'exponential', 200, 10_000)
    expect(d0).toBe(200) // 200 * 2^0
    expect(d1).toBe(400) // 200 * 2^1
    expect(d2).toBe(800) // 200 * 2^2
  })

  it('calculateDelay caps at maxDelay', () => {
    const delay = calculateDelay(10, 'exponential', 200, 1000)
    expect(delay).toBe(1000)
  })

  it('withRetry returns result on first success', async () => {
    const result = await withRetry(() => Promise.resolve(42), { maxAttempts: 3, backoff: 'fixed' })
    expect(result).toBe(42)
  })

  it('withRetry retries on failure', async () => {
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

  it('withRetry throws after max attempts', async () => {
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
  it('formatFileSize formats bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(1023)).toBe('1023 B')
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB')
  })

  it('getExtension extracts extension', () => {
    expect(getExtension('file.txt')).toBe('txt')
    expect(getExtension('image.webp')).toBe('webp')
    expect(getExtension('noext')).toBe('')
    expect(getExtension('path/to/file.mp4')).toBe('mp4')
  })

  it('extensionToMime returns correct MIME types', () => {
    expect(extensionToMime('mp4')).toBe('video/mp4')
    expect(extensionToMime('webp')).toBe('image/webp')
    expect(extensionToMime('pdf')).toBe('application/pdf')
    expect(extensionToMime('unknown')).toBe('application/octet-stream')
  })

  it('keyToMime derives MIME from key', () => {
    expect(keyToMime('courses/123/videos/vid.mp4')).toBe('video/mp4')
  })

  it('normaliseKey strips leading slashes and collapses repeats', () => {
    expect(normaliseKey('/foo//bar/')).toBe('foo/bar/')
    expect(normaliseKey('foo/bar')).toBe('foo/bar')
  })

  it('joinKey joins segments', () => {
    expect(joinKey('a', 'b', 'c')).toBe('a/b/c')
  })

  it('maskSensitive masks values', () => {
    expect(maskSensitive('mysecretkey123', 4)).toBe('myse**********')
    expect(maskSensitive('ab', 4)).toBe('**')
  })
})

describe('Validator utilities', () => {
  it('validateSize passes within limit', () => {
    expect(() => validateSize(1000, 2000)).not.toThrow()
  })

  it('validateSize throws when exceeded', () => {
    // validateSize takes maxSizeMb, so 0.001 MB = ~1KB
    expect(() => validateSize(3000, 0.001)).toThrow(StorageValidationError)
  })

  it('validateMimeType accepts allowed types', () => {
    expect(() => validateMimeType('image/jpeg', ['image/*', 'video/mp4'])).not.toThrow()
  })

  it('validateMimeType rejects disallowed types', () => {
    expect(() => validateMimeType('text/html', ['image/*'])).toThrow()
  })

  it('validateExtension accepts allowed extensions', () => {
    expect(() => validateExtension('mp4', ['mp4', 'webm'])).not.toThrow()
  })

  it('validateExtension rejects disallowed extensions', () => {
    expect(() => validateExtension('exe', ['mp4', 'webm'])).toThrow()
  })

  it('validateCustom works with predicate', () => {
    expect(() => validateCustom(5, (v) => v > 0, 'must be positive')).not.toThrow()
    expect(() => validateCustom(-1, (v) => v > 0, 'must be positive')).toThrow()
  })
})

describe('Validation modules', () => {
  it('validateSizeValidation throws for oversized files', () => {
    expect(() => validateSizeValidation(10_000_000, 5_000_000)).toThrow()
  })

  it('validateQuota checks MB limit', () => {
    expect(() => validateQuota(3 * 1024 * 1024, 5)).not.toThrow()
    expect(() => validateQuota(10 * 1024 * 1024, 5)).toThrow()
  })

  it('SIZE_LIMITS has expected values', () => {
    expect(SIZE_LIMITS.AVATAR).toBe(5 * 1024 * 1024)
    expect(SIZE_LIMITS.S3_MAX).toBe(5 * 1024 * 1024 * 1024)
  })

  it('validateMimeTypeValidation works with wildcard', () => {
    expect(() => validateMimeTypeValidation('image/png', MIME_TYPES.IMAGES)).not.toThrow()
    expect(() => validateMimeTypeValidation('text/html', MIME_TYPES.IMAGES)).toThrow()
  })

  it('validateExtensionValidation works', () => {
    expect(() => validateExtensionValidation('mp4', EXTENSIONS.VIDEOS)).not.toThrow()
    expect(() => validateExtensionValidation('exe', EXTENSIONS.VIDEOS)).toThrow()
  })
})
