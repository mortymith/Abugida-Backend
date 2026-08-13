/**
 * File extension validation.
 */

import { StorageValidationError } from '../utils/errors.ts'

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
 * Extract the extension from a filename or key.
 */
export function extractExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex === -1 || dotIndex === filename.length - 1) return ''
  return filename.slice(dotIndex + 1).toLowerCase()
}
