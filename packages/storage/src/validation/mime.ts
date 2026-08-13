/**
 * MIME type validation.
 */

import { StorageValidationError } from '../utils/errors.ts'

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

/**
 * Validate that a MIME type is in the allowed set.
 *
 * Supports wildcard patterns like `image/*`.
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
 * Detect MIME type from a file extension.
 */
export function detectMimeType(extension: string): string {
  const ext = extension.toLowerCase().replace(/^\./, '')
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    json: 'application/json',
    csv: 'text/csv',
    vtt: 'text/vtt',
    srt: 'text/srt',
    txt: 'text/plain',
  }
  return map[ext] ?? 'application/octet-stream'
}
