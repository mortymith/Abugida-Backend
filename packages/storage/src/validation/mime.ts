/**
 * MIME type validation.
 */

import { StorageValidationError } from '../utils/errors.js'

/** Allowed MIME type sets for different asset categories. */
export const MIME_TYPES = {
  /** Common image MIME types. */
  IMAGES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/x-icon',
  ] as const,

  /** Common video MIME types. */
  VIDEOS: [
    'video/mp4',
    'video/mpeg',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
  ] as const,

  /** Common audio MIME types. */
  AUDIO: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac'] as const,

  /** Common document MIME types. */
  DOCUMENTS: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ] as const,

  /** Subtitle MIME types. */
  SUBTITLES: ['text/vtt', 'text/srt', 'text/plain'] as const,

  /** Data formats. */
  DATA: ['application/json', 'text/csv', 'application/xml', 'text/plain'] as const,
} as const

/** Extension → MIME type lookup. This is the single source of truth for the package. */
const MIME_BY_EXTENSION: Record<string, string> = {
  // Images
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  // Video
  mp4: 'video/mp4',
  mpeg: 'video/mpeg',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  // Audio
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  aac: 'audio/aac',
  // Documents
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Data
  json: 'application/json',
  csv: 'text/csv',
  xml: 'application/xml',
  txt: 'text/plain',
  // Subtitles
  vtt: 'text/vtt',
  srt: 'text/srt',
  // Archive
  zip: 'application/zip',
  gz: 'application/gzip',
  tar: 'application/x-tar',
}

/** Fallback used when an extension is unknown or absent. */
const DEFAULT_MIME_TYPE = 'application/octet-stream'

/**
 * Validate that a MIME type is in the allowed set.
 *
 * Supports wildcard patterns like `image/*`.
 *
 * @param contentType - The MIME type to check.
 * @param allowed - Allowed MIME types (may include wildcards).
 * @throws {StorageValidationError} when the type is not allowed.
 */
export function validateMimeType(contentType: string, allowed: readonly string[]): void {
  const isAllowed = allowed.some((pattern) => {
    if (pattern.endsWith('/*')) {
      return contentType.startsWith(pattern.slice(0, -1))
    }
    return contentType === pattern
  })

  if (!isAllowed) {
    throw new StorageValidationError(
      `MIME type "${contentType}" is not allowed. Allowed types: ${allowed.join(', ')}`,
      { rule: 'mime' },
    )
  }
}

/**
 * Validate a MIME type and narrow an `unknown` value to `string`.
 *
 * Use this at trust boundaries (request bodies, form fields) where the value is
 * not yet known to be a string.
 *
 * @param contentType - The untrusted MIME type.
 * @param allowed - Allowed MIME types (may include wildcards).
 * @throws {StorageValidationError} when the value is not a string or not allowed.
 */
export function assertMimeType(
  contentType: unknown,
  allowed: readonly string[],
): asserts contentType is string {
  if (typeof contentType !== 'string' || contentType.length === 0) {
    throw new StorageValidationError('MIME type must be a non-empty string.', { rule: 'mime' })
  }
  validateMimeType(contentType, allowed)
}

/**
 * Detect the MIME type for a file extension.
 *
 * @param extension - File extension, with or without a leading dot.
 * @returns The matching MIME type, or `application/octet-stream` when unknown.
 */
export function detectMimeType(extension: string): string {
  const ext = extension.toLowerCase().replace(/^\./, '')
  return MIME_BY_EXTENSION[ext] ?? DEFAULT_MIME_TYPE
}
