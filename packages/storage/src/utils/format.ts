/**
 * Formatting and data transformation utilities.
 */

/**
 * Format file size in human-readable form.
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
 */
export function getExtension(key: string): string {
  const dotIndex = key.lastIndexOf('.')
  if (dotIndex === -1 || dotIndex === key.length - 1) return ''
  return key.slice(dotIndex + 1).toLowerCase()
}

/**
 * Derive a MIME type from a file extension.
 */
export function extensionToMime(ext: string): string {
  const map: Record<string, string> = {
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
  return map[ext] ?? 'application/octet-stream'
}

/**
 * Derive a MIME type from a storage key.
 */
export function keyToMime(key: string): string {
  return extensionToMime(getExtension(key))
}

/**
 * Normalise a storage key: strip leading slashes, collapse repeated slashes.
 */
export function normaliseKey(key: string): string {
  return key.replace(/^\/+/, '').replace(/\/+/g, '/')
}

/**
 * Join key segments with `/`, producing a normalised path.
 */
export function joinKey(...segments: string[]): string {
  return normaliseKey(segments.join('/'))
}

/**
 * Mask sensitive values for log output.
 */
export function maskSensitive(value: string, visibleChars = 4): string {
  if (value.length <= visibleChars) return '*'.repeat(value.length)
  return value.slice(0, visibleChars) + '*'.repeat(value.length - visibleChars)
}
