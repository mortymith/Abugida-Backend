import type { AssetCategory } from '@abugida/database/catalog'

/** Content Library DTOs (spec 05 S-3.1 – S-3.6). Client-safe. */

export interface LibraryAssetCard {
  publicId: string
  name: string
  category: AssetCategory
  mimeType: string | null
  fileSizeBytes: number | null
  durationSeconds: number | null
  folderId: string | null
  folderName: string | null
  tags: string[]
  currentVersion: number
  createdAt: string
  /** Lessons linking this asset (asset_usage) — drives "N uses" on cards. */
  usageCount: number
  /** Short-lived inline URL for image cards (grid thumbnails, S-3.1). */
  previewUrl: string | null
}

export interface LibraryAssetPage {
  rows: LibraryAssetCard[]
  page: number
  pageSize: number
  totalRows: number
  hasNextPage: boolean
}

export interface LibraryCategoryStat {
  count: number
  bytes: number
}

export interface LibraryStats {
  total: LibraryCategoryStat
  video: LibraryCategoryStat
  document: LibraryCategoryStat
  image: LibraryCategoryStat
  audio: LibraryCategoryStat
}

export interface LibraryFolderNode {
  publicId: string
  name: string
  parentId: string | null
  /** Direct (non-recursive) count of active assets. */
  assetCount: number
}

export interface AssetDetailDTO {
  publicId: string
  name: string
  description: string | null
  tags: string[]
  category: AssetCategory
  mimeType: string | null
  fileSizeBytes: number | null
  durationSeconds: number | null
  objectKey: string
  currentVersion: number
  folderId: string | null
  folderName: string | null
  uploadedByName: string | null
  createdAt: string
  updatedAt: string
  usageCount: number
}

export interface AssetUsageRow {
  coursePublicId: string
  courseTitle: string
  modulePublicId: string
  moduleTitle: string
  lessonPublicId: string
  lessonTitle: string
  lessonContentType: string | null
}

export interface AssetUsageDTO {
  lessonUses: AssetUsageRow[]
  /** Courses whose thumbnail_object_key points at this asset. */
  thumbnailCourses: { coursePublicId: string; courseTitle: string }[]
}

export interface AssetVersionDTO {
  versionNumber: number
  objectKey: string
  fileSizeBytes: number | null
  mimeType: string | null
  uploadedByName: string | null
  createdAt: string
  isCurrent: boolean
}

export interface TranscriptSegmentDTO {
  segmentIndex: number
  startMs: number
  endMs: number
  speaker: string | null
  text: string
}

export interface TranscriptDTO {
  assetPublicId: string
  assetName: string
  assetMimeType: string | null
  assetDurationSeconds: number | null
  assetFileSizeBytes: number | null
  language: string
  status: 'draft' | 'published' | 'failed'
  showByDefault: boolean
  source: 'manual' | 'imported' | 'stt' | 'translated'
  captionStyle: {
    font: 'inter' | 'system' | 'serif' | 'mono'
    fontSizePx: 14 | 16 | 18 | 20
    background: 'none' | 'semi' | 'opaque'
  } | null
  segments: TranscriptSegmentDTO[]
  availableLanguages: string[]
}
