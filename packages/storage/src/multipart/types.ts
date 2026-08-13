/**
 * Multipart upload types.
 */

/** Result of initiating a multipart upload. */
export interface MultipartCreateResult {
  /** The storage key. */
  key: string
  /** Upload ID assigned by S3. */
  uploadId: string
}

/** Result of uploading a single part. */
export interface MultipartUploadPartResult {
  /** Part number (1-based). */
  partNumber: number
  /** ETag of the uploaded part. */
  etag: string
}

/** A completed part descriptor for completing a multipart upload. */
export interface CompletedPart {
  /** Part number. */
  partNumber: number
  /** ETag returned when the part was uploaded. */
  etag: string
}

/** Result of completing a multipart upload. */
export interface MultipartCompleteResult {
  /** The storage key. */
  key: string
  /** ETag of the assembled object. */
  etag?: string
  /** Version ID (if bucket versioning is enabled). */
  versionId?: string
}

/** A listed part from an in-progress multipart upload. */
export interface MultipartListedPart {
  /** Part number. */
  partNumber: number
  /** ETag. */
  etag?: string
  /** Size in bytes. */
  size?: number
  /** Last modified date. */
  lastModified?: Date
}

/** Options for multipart upload part. */
export interface MultipartUploadPartOptions {
  /** Content type for the part. */
  contentType?: string
}

/** Minimum part size for S3 multipart uploads (5 MB except for the last part). */
export const MIN_PART_SIZE = 5 * 1024 * 1024

/** Maximum number of parts per upload (10,000 for S3). */
export const MAX_PARTS = 10_000
