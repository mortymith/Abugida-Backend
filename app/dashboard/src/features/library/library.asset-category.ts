import type { AssetCategory } from '@abugida/database/catalog'
import type { LibraryCategoryFilter } from './schemas/library.schema'

/**
 * Content Library asset classification + upload constraints (spec 05 S-3.1 /
 * S-3.2). Wireframe contract: "Supported: MP4, PDF, PNG, JPG, MP3 · Max size:
 * 500MB". Pure logic — unit-tested, shared by client validation and the
 * server-side upload gate.
 */

export const ASSET_MAX_SIZE_BYTES = 500 * 1024 * 1024

/**
 * Object-key namespace owned by the Content Library. Presigned PUTs are always
 * minted under this prefix by `getAssetUploadUrl` / `uploadAssetVersion`, and
 * upload completion re-checks the key it is handed so a caller cannot adopt an
 * arbitrary object that happens to exist in the bucket.
 */
export const ASSET_OBJECT_KEY_PREFIX = 'asset-library/'

/** True when `objectKey` came from the library's own presign flow. */
export function isLibraryObjectKey(objectKey: string): boolean {
  const trimmed = objectKey.trim()
  if (!trimmed.startsWith(ASSET_OBJECT_KEY_PREFIX)) return false
  // Reject traversal: "asset-library/../../other-bucket/key" would escape the prefix.
  return !trimmed.split('/').includes('..') && !trimmed.includes('\\')
}

/** MIME types accepted by the library upload flow, with display labels. */
export const ASSET_MIME_TYPES = {
  'video/mp4': 'MP4 video',
  'application/pdf': 'PDF document',
  'image/png': 'PNG image',
  'image/jpeg': 'JPG image',
  'audio/mpeg': 'MP3 audio',
} as const

export type AssetMimeType = keyof typeof ASSET_MIME_TYPES

export const ASSET_MIME_LIST = Object.keys(ASSET_MIME_TYPES) as AssetMimeType[]

/** File-extension → MIME mapping for the supported upload types. */
export const ASSET_EXTENSION_MIME: Record<string, AssetMimeType | undefined> = {
  mp4: 'video/mp4',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  mp3: 'audio/mpeg',
}

export function isSupportedAssetMime(contentType: string): contentType is AssetMimeType {
  return Object.prototype.hasOwnProperty.call(ASSET_MIME_TYPES, contentType)
}

export function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]{1,8})$/i.exec(fileName.trim())
  return match && match[1] ? match[1].toLowerCase() : ''
}

/** MIME for an uploaded file, falling back to its extension. */
export function resolveAssetMime(fileName: string, clientType: string | null): string | null {
  if (clientType && isSupportedAssetMime(clientType)) return clientType
  const byExtension = ASSET_EXTENSION_MIME[extensionOf(fileName)]
  return byExtension ?? clientType
}

export function categoryForMime(mimeType: string | null): AssetCategory {
  if (!mimeType) return 'other'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType === 'application/pdf') return 'document'
  return 'other'
}

export function isTranscribableCategory(category: AssetCategory): boolean {
  return category === 'video' || category === 'audio'
}

/** Human-readable byte size ("2.3 MB") — spec card metadata line. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB'] as const
  let value = bytes
  let unitIndex = -1
  do {
    value /= 1024
    unitIndex += 1
  } while (value >= 1024 && unitIndex < units.length - 1)
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[unitIndex] ?? 'B'}`
}

/** Storage-used label for stat cards ("12GB used"). */
export function formatStorageUsed(bytes: number): string {
  if (bytes <= 0) return '0 KB used'
  return `${formatBytes(bytes)} used`
}

/** Strip anything that could break an object key or confuse the UI. */
export function sanitizeFileName(fileName: string): string {
  const base = fileName.trim().replace(/[/\\]/g, '-').replace(/\s+/g, ' ')
  return base.slice(0, 200)
}

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  video: 'Video',
  image: 'Image',
  audio: 'Audio',
  document: 'PDF',
  other: 'Other',
}

/**
 * Server filter for a picker restricted to a set of categories.
 *
 * Filtering client-side *after* the server already paged the list is unsound:
 * a page of 12 videos rendered as "No matching assets" for a PDF slot even when
 * PDFs existed on page 2. With a single acceptable category the filter is
 * pushed down to the server. The server filter only knows real categories
 * (never the 'other' bucket, which the wireframe never offers), so several
 * categories fall back to filtering the fetched page locally.
 */
export function pickerCategoryFilter(categories: readonly AssetCategory[]): {
  category?: LibraryCategoryFilter
  filterLocally: boolean
} {
  const only = categories.length === 1 ? categories[0] : undefined
  if (only && only !== 'other') return { category: only, filterLocally: false }
  return { category: undefined, filterLocally: categories.length > 1 }
}
