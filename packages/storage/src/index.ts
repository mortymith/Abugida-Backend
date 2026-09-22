/**
 * @abugida/storage — Shared object storage layer for the Abugida Application monorepo.
 *
 * This module re-exports the entire public API. Import what you need:
 *
 * ```ts
 * import { createStorage, StorageError } from "@abugida/storage";
 * ```
 *
 * Or import the pre-built Hono / TanStack integrations:
 *
 * ```ts
 * import { createHonoClient } from "@abugida/storage/hono";
 * import { createTanStackClient } from "@abugida/storage/tanstack";
 * ```
 */

// Core
export { Storage, createStorage, storageKeys } from './core/storage.js'
export type {
  StorageConfig,
  StorageProvider,
  BackoffStrategy,
  RetryConfig,
  EncryptionConfig,
  LoggingConfig,
  QuotaConfig,
  PutResult,
  PutManyResult,
  ObjectMetadata,
  GetResult,
  ExistsResult,
  DeleteResult,
  DeleteManyResult,
  CopyResult,
  MoveResult,
  ListResult,
  ListedObject,
  TagSet,
  PutOptions,
  PutManyItem,
  PutManyOptions,
  GetOptions,
  HeadOptions,
  DeleteOptions,
  CopyOptions,
  MoveOptions,
  ListOptions,
  BodyInput,
} from './core/types.js'

// Client & Connection
export { createClient, getOrCreateClient, destroyClient, destroyAllClients } from './core/client.js'
export { checkHealth, CircuitBreaker } from './core/connection.js'
export type { HealthCheckResult, CircuitState, CircuitBreakerConfig } from './core/connection.js'

// Errors
export {
  StorageError,
  StorageNotFoundError,
  StorageAccessDeniedError,
  StorageUploadError,
  StorageDownloadError,
  StorageValidationError,
  StorageTimeoutError,
  StorageConflictError,
  StorageQuotaError,
  StorageKeyError,
  classifyError,
} from './utils/errors.js'

// Config
export { validateConfig, PROVIDER_DEFAULTS } from './config/schema.js'
export { DEFAULT_MINIO_CONFIG, DEFAULT_AWS_CONFIG, DEFAULT_R2_CONFIG } from './config/defaults.js'
export { configFromEnv, hasEnvConfig } from './config/env.js'

// Presigned types
export type { PresignedUrlOptions, PresignedUrlResult } from './presigned/types.js'

// Multipart types
export type {
  MultipartCreateResult,
  MultipartUploadPartResult,
  MultipartCompleteResult,
  CompletedPart,
  MultipartListedPart,
  MultipartUploadPartOptions,
} from './multipart/types.js'
export { MIN_PART_SIZE, MAX_PARTS } from './multipart/types.js'

// Validation
export { validateSize, validateQuota, SIZE_LIMITS } from './validation/size.js'
export { validateMimeType, detectMimeType, MIME_TYPES } from './validation/mime.js'
export { validateExtension, extractExtension, EXTENSIONS } from './validation/extension.js'
export {
  calculateChecksum,
  calculateStreamChecksum,
  calculateChecksumHex,
} from './validation/checksum.js'

// Utilities
export { withRetry, calculateDelay, sleep } from './utils/retry.js'
export type { RetryOptions } from './utils/retry.js'
export {
  streamToBuffer,
  bufferToStream,
  measureStream,
  chunkStream,
  toReadableStream,
  getBodyLength,
} from './utils/stream.js'
export {
  formatFileSize,
  getExtension,
  extensionToMime,
  keyToMime,
  normaliseKey,
  joinKey,
  maskSensitive,
} from './utils/format.js'
export { validateCustom } from './utils/validators.js'
