/**
 * File extension validation.
 */

import { StorageValidationError } from '../utils/errors.js'

/** Allowed extension sets for different asset categories. */
export const EXTENSIONS = {
  IMAGES: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp'] as const,
  VIDEOS: ['mp4', 'mpeg', 'webm', 'avi', 'mov', 'mkv'] as const,
  AUDIO: ['mp3', 'wav', 'ogg', 'flac', 'aac'] as const,
  DOCUMENTS: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'] as const,
  SUBTITLES: ['vtt', 'srt'] as const,
  DATA: ['json', 'csv', 'xml', 'txt'] as const,
} as const

/**
 * Validate that a file extension is in the allowed set.
 *
 * @param extension - The extension (without dot, case-insensitive).
 * @param allowed - Allowed extensions.
 * @throws {StorageValidationError} when the extension is not allowed.
 */
export function validateExtension(extension: string, allowed: readonly string[]): void {
  const ext = extension.toLowerCase().replace(/^\./, '')
  const allowedLower = allowed.map((e) => e.toLowerCase())

  if (!allowedLower.includes(ext)) {
    throw new StorageValidationError(
      `File extension ".${ext}" is not allowed. Allowed: ${allowedLower.map((e) => `.${e}`).join(', ')}`,
      { rule: 'extension' },
    )
  }
}

/**
 * Validate a file extension and narrow an `unknown` value to `string`.
 *
 * Use this at trust boundaries (request bodies, form fields) where the value is
 * not yet known to be a string.
 *
 * @param extension - The untrusted extension.
 * @param allowed - Allowed extensions.
 * @throws {StorageValidationError} when the value is not a string or not allowed.
 */
export function assertExtension(
  extension: unknown,
  allowed: readonly string[],
): asserts extension is string {
  if (typeof extension !== 'string' || extension.length === 0) {
    throw new StorageValidationError('File extension must be a non-empty string.', {
      rule: 'extension',
    })
  }
  validateExtension(extension, allowed)
}

/**
 * Extract the extension from a filename or key.
 *
 * @param filename - Filename or storage key.
 * @returns The lowercased extension without the dot, or `''` when absent.
 */
export function extractExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex === -1 || dotIndex === filename.length - 1) return ''
  return filename.slice(dotIndex + 1).toLowerCase()
}
