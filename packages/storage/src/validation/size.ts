/**
 * File size validation.
 */

import { StorageQuotaError } from '../utils/errors.ts'

/** Common file size limits in bytes. */
export const SIZE_LIMITS = {
  /** 5 MB — typical limit for avatars and small images. */
  AVATAR: 5 * 1024 * 1024,
  /** 50 MB — typical limit for documents. */
  DOCUMENT: 50 * 1024 * 1024,
  /** 500 MB — typical limit for video files. */
  VIDEO: 500 * 1024 * 1024,
  /** 100 MB — typical limit for audio files. */
  AUDIO: 100 * 1024 * 1024,
  /** 10 MB — typical limit for profile images. */
  PROFILE: 10 * 1024 * 1024,
  /** 25 MB — typical limit for banner images. */
  BANNER: 25 * 1024 * 1024,
  /** 500 MB — typical limit for export files. */
  EXPORT: 500 * 1024 * 1024,
  /** 5 GB — S3 single-operation limit. */
  S3_MAX: 5 * 1024 * 1024 * 1024,
} as const

/**
 * Validate that a file size is within the allowed limit.
 *
 * @param sizeBytes - File size in bytes.
 * @param maxSizeBytes - Maximum size in bytes.
 * @throws {StorageQuotaError} when the file exceeds the limit.
 */
export function validateSize(sizeBytes: number, maxSizeBytes: number): void {
  if (sizeBytes > maxSizeBytes) {
    throw new StorageQuotaError(
      `File size ${formatBytes(sizeBytes)} exceeds limit of ${formatBytes(maxSizeBytes)}`,
      { limit: maxSizeBytes },
    )
  }
}

/**
 * Validate that a file size is within the global quota.
 *
 * @param sizeBytes - File size in bytes.
 * @param maxFileSizeMb - Maximum size in megabytes from config.
 * @throws {StorageQuotaError} when the file exceeds the quota.
 */
export function validateQuota(sizeBytes: number, maxFileSizeMb: number): void {
  const maxBytes = maxFileSizeMb * 1024 * 1024
  validateSize(sizeBytes, maxBytes)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
