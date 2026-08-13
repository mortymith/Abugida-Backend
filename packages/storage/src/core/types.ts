/**
 * Core type definitions for @abugida/storage.
 *
 * These types define the public surface area of the storage package,
 * including configuration, operation results, and provider identifiers.
 */

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Supported S3-compatible storage providers. */
export type StorageProvider = 'aws-s3' | 'minio' | 'r2' | 'spaces' | 'wasabi' | 'b2'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Retry backoff strategy. */
export type BackoffStrategy = 'exponential' | 'fixed' | 'adaptive'

/** Retry configuration. */
export interface RetryConfig {
  /** Maximum number of retry attempts. */
  maxAttempts: number
  /** Backoff algorithm to use between retries. */
  backoff: BackoffStrategy
  /** Base delay in milliseconds before the first retry. */
  baseDelay?: number
  /** Maximum delay cap in milliseconds. */
  maxDelay?: number
}

/** Server-side encryption configuration. */
export interface EncryptionConfig {
  /** Whether to enable server-side encryption. */
  enabled: boolean
  /** KMS key ID (required when algorithm is `aws:kms`). */
  keyId?: string
  /** Encryption algorithm. `AES256` = SSE-S3, `aws:kms` = SSE-KMS. */
  algorithm?: 'AES256' | 'aws:kms'
}

/** Logging configuration. */
export interface LoggingConfig {
  /** Minimum log level. */
  level: 'debug' | 'info' | 'warn' | 'error'
  /** Output format. */
  format: 'json' | 'pretty'
  /** Mask sensitive values (credentials, presigned URLs) in log output. */
  sensitiveDataMasking?: boolean
}

/** Quota configuration. */
export interface QuotaConfig {
  /** Maximum file size in megabytes. */
  maxFileSize: number
}

/** Full storage configuration. */
export interface StorageConfig {
  /** S3-compatible storage provider identifier. */
  provider: StorageProvider
  /** S3-compatible endpoint URL. */
  endpoint: string
  /** AWS region (or provider-specific region). */
  region: string
  /** Access key ID. */
  accessKeyId: string
  /** Secret access key. */
  secretAccessKey: string
  /** Default bucket name. */
  bucket: string

  /** Use path-style addressing (required for MinIO and most non-AWS providers). */
  forcePathStyle?: boolean
  /** Enable S3 Transfer Acceleration endpoint. */
  useAccelerateEndpoint?: boolean

  /** Maximum retry attempts for failed requests. */
  maxAttempts?: number
  /** Per-request timeout in milliseconds. */
  requestTimeout?: number
  /** Connection establishment timeout in milliseconds. */
  connectionTimeout?: number

  /** Advanced retry configuration. */
  retryStrategy?: RetryConfig

  /** Server-side encryption settings. */
  encryption?: EncryptionConfig

  /** Logging settings. */
  logging?: LoggingConfig

  /** Quota limits. */
  quotas?: QuotaConfig
}

// ---------------------------------------------------------------------------
// Operation result types
// ---------------------------------------------------------------------------

/** Result of a single object upload. */
export interface PutResult {
  /** The storage key the object was written to. */
  key: string
  /** ETag returned by the storage provider. */
  etag?: string
  /** Version ID (if bucket versioning is enabled). */
  versionId?: string
  /** SHA-256 checksum of the uploaded content. */
  checksum?: string
}

/** Result of a batch upload. */
export interface PutManyResult {
  /** Results for each individual upload. */
  results: PutResult[]
  /** Keys that failed to upload (if any). */
  failures?: Array<{ key: string; error: Error }>
}

/** Object metadata returned by head / getMetadata. */
export interface ObjectMetadata {
  /** Storage key. */
  key: string
  /** Content type (MIME type). */
  contentType?: string
  /** Content length in bytes. */
  contentLength?: number
  /** ETag. */
  etag?: string
  /** Last modified date. */
  lastModified?: Date
  /** Version ID. */
  versionId?: string
  /** Custom metadata keys and values. */
  metadata?: Record<string, string>
  /** Cache control header. */
  cacheControl?: string
  /** Content disposition header. */
  contentDisposition?: string
  /** Content encoding. */
  contentEncoding?: string
}

/** Result of a download operation. */
export interface GetResult {
  /** The object body as a readable stream. */
  body: ReadableStream<Uint8Array>
  /** Object metadata. */
  metadata: ObjectMetadata
}

/** Result of an object existence check. */
export interface ExistsResult {
  /** Whether the object exists. */
  exists: boolean
  /** ETag if the object exists. */
  etag?: string
  /** Content length if the object exists. */
  contentLength?: number
}

/** Result of a delete operation. */
export interface DeleteResult {
  /** The key that was deleted. */
  key: string
  /** Version ID deleted (if applicable). */
  versionId?: string
}

/** Result of a batch delete. */
export interface DeleteManyResult {
  /** Successfully deleted keys. */
  deleted: string[]
  /** Keys that could not be deleted. */
  errors?: Array<{ key: string; error: Error }>
}

/** Result of a copy operation. */
export interface CopyResult {
  /** Destination key. */
  key: string
  /** ETag of the copied object. */
  etag?: string
  /** Version ID of the copy. */
  versionId?: string
}

/** Result of a move operation. */
export interface MoveResult {
  /** Destination key. */
  key: string
  /** ETag of the moved object. */
  etag?: string
}

/** Object listed from a prefix scan. */
export interface ListedObject {
  /** Storage key. */
  key: string
  /** Object size in bytes. */
  size?: number
  /** ETag. */
  etag?: string
  /** Last modified date. */
  lastModified?: Date
}

/** Result of a list operation. */
export interface ListResult {
  /** Objects found under the prefix. */
  objects: ListedObject[]
  /** Whether there are more results available. */
  isTruncated: boolean
  /** Continuation token for the next page. */
  continuationToken?: string
  /** Common prefixes (directories) if delimiter was used. */
  commonPrefixes?: string[]
}

/** Tag set for an object. */
export type TagSet = Record<string, string>

// ---------------------------------------------------------------------------
// Put operation options
// ---------------------------------------------------------------------------

/** Options for the put operation. */
export interface PutOptions {
  /** MIME content type. */
  contentType?: string
  /** Custom metadata to attach to the object. */
  metadata?: Record<string, string>
  /** Cache-Control header value. */
  cacheControl?: string
  /** Content-Disposition header value. */
  contentDisposition?: string
  /** Content-Encoding value. */
  contentEncoding?: string
  /** Pre-computed SHA-256 checksum for integrity verification. */
  checksum?: string
  /** Server-side encryption algorithm override for this request. */
  encryption?: 'AES256' | 'aws:kms'
  /** KMS key ID (when encryption is `aws:kms`). */
  encryptionKeyId?: string
}

/** A single item in a putMany batch. */
export interface PutManyItem {
  /** Destination storage key. */
  key: string
  /** Object body. */
  body: BodyInput
  /** Per-item put options. */
  options?: PutOptions
}

/** Options for the putMany batch operation. */
export interface PutManyOptions {
  /** Maximum number of concurrent uploads. */
  concurrency?: number
  /** Progress callback invoked after each item completes. */
  onProgress?: (completed: number, total: number) => void
}

/** Options for the get operation. */
export interface GetOptions {
  /** Request only a specific byte range (e.g. `bytes=0-1023`). */
  range?: string
  /** Specific version ID to retrieve. */
  versionId?: string
}

/** Options for the head operation. */
export interface HeadOptions {
  /** Specific version ID. */
  versionId?: string
}

/** Options for the delete operation. */
export interface DeleteOptions {
  /** Specific version ID to delete. */
  versionId?: string
}

/** Options for the copy operation. */
export interface CopyOptions {
  /** Custom metadata for the destination object. */
  metadata?: Record<string, string>
  /** Content type for the destination. */
  contentType?: string
  /** Directive: COPY keeps source metadata, REPLACE uses provided metadata. */
  metadataDirective?: 'COPY' | 'REPLACE'
}

/** Options for the move operation. */
export interface MoveOptions extends CopyOptions {}

/** Options for the list operation. */
export interface ListOptions {
  /** Maximum number of keys to return per request. */
  maxKeys?: number
  /** Continuation token from a previous list call. */
  continuationToken?: string
  /** Delimiter for grouping keys (e.g. `/` for directory-like listing). */
  delimiter?: string
  /** Start after this key (lexicographic ordering). */
  startAfter?: string
}

// ---------------------------------------------------------------------------
// Body input type
// ---------------------------------------------------------------------------

/**
 * Acceptable body types for upload operations.
 * Supports Bun's File/Blob, Node Readable streams, Uint8Array, and strings.
 */
export type BodyInput = ReadableStream | Uint8Array | ArrayBuffer | string | Blob | File
