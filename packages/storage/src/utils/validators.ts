/**
 * Validation utility helpers — composable predicates for file validation.
 */

import { StorageValidationError } from './errors.ts'

/**
 * Validate that a file size is within the allowed limit.
 *
 * @param sizeBytes - File size in bytes.
 * @param maxSizeMb - Maximum size in megabytes.
 * @throws {StorageValidationError} when the file exceeds the limit.
 */
export function validateSize(sizeBytes: number, maxSizeMb: number): void {
  const maxBytes = maxSizeMb * 1024 * 1024
  if (sizeBytes > maxBytes) {
    throw new StorageValidationError(
      `File size ${sizeBytes} bytes exceeds limit of ${maxBytes} bytes (${maxSizeMb} MB)`,
      { rule: 'size' },
    )
  }
}

/**
 * Validate that a MIME type is in the allowed set.
 *
 * @param contentType - The MIME type to check.
 * @param allowed - Set of allowed MIME types (may include wildcards like `image/*`).
 * @throws {StorageValidationError} when the type is not allowed.
 */
export function validateMimeType(contentType: string, allowed: string[]): void {
  const isAllowed = allowed.some((pattern) => {
    if (pattern.endsWith('/*')) {
      return contentType.startsWith(pattern.slice(0, -1))
    }
    return contentType === pattern
  })

  if (!isAllowed) {
    throw new StorageValidationError(
      `MIME type "${contentType}" is not allowed. Allowed: ${allowed.join(', ')}`,
      { rule: 'mime' },
    )
  }
}

/**
 * Validate that a file extension is in the allowed set.
 *
 * @param extension - The file extension (without dot, lowercased).
 * @param allowed - Allowed extensions (lowercased, without dots).
 * @throws {StorageValidationError} when the extension is not allowed.
 */
export function validateExtension(extension: string, allowed: string[]): void {
  const ext = extension.toLowerCase()
  if (!allowed.includes(ext)) {
    throw new StorageValidationError(
      `File extension ".${ext}" is not allowed. Allowed: ${allowed.map((e) => `.${e}`).join(', ')}`,
      { rule: 'extension' },
    )
  }
}

/**
 * Run a custom validation function.
 *
 * @param value - The value to validate.
 * @param predicate - A function that returns `true` when valid.
 * @param message - Error message on failure.
 * @throws {StorageValidationError} when the predicate returns `false`.
 */
export function validateCustom<T>(value: T, predicate: (v: T) => boolean, message: string): void {
  if (!predicate(value)) {
    throw new StorageValidationError(message, { rule: 'custom' })
  }
}
