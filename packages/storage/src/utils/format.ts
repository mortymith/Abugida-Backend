/**
 * Formatting and data transformation utilities.
 *
 * The MIME and extension lookups here are thin aliases over the canonical
 * implementations in `../validation/` so there is a single source of truth for
 * each mapping.
 */

import { extractExtension } from '../validation/extension.js'
import { detectMimeType } from '../validation/mime.js'

/**
 * Format file size in human-readable form.
 *
 * @param bytes - Size in bytes.
 * @returns A human-readable string, e.g. `1.0 MB`.
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let unitIndex = 0
  let size = bytes

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

/**
 * Extract the file extension from a key (lowercased).
 *
 * Alias of {@link extractExtension}.
 */
export function getExtension(key: string): string {
  return extractExtension(key)
}

/**
 * Derive a MIME type from a file extension.
 *
 * Alias of {@link detectMimeType}.
 */
export function extensionToMime(ext: string): string {
  return detectMimeType(ext)
}

/**
 * Derive a MIME type from a storage key.
 */
export function keyToMime(key: string): string {
  return detectMimeType(extractExtension(key))
}

/**
 * Normalize a storage key: strip leading slashes, collapse repeated slashes.
 */
export function normalizeKey(key: string): string {
  return key.replace(/^\/+/, '').replace(/\/+/g, '/')
}

/**
 * Join key segments with `/`, producing a normalized path.
 */
export function joinKey(...segments: string[]): string {
  return normalizeKey(segments.join('/'))
}
