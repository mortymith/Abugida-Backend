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
export { Storage, createStorage, storageKeys } from './core/storage.ts'
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
} from './core/types.ts'

// Client & Connection
export { createClient, getOrCreateClient, destroyClient, destroyAllClients } from './core/client.ts'
export { checkHealth, CircuitBreaker } from './core/connection.ts'
export type { HealthCheckResult, CircuitState, CircuitBreakerConfig } from './core/connection.ts'

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
} from './utils/errors.ts'

// Config
export { validateConfig, PROVIDER_DEFAULTS } from './config/schema.ts'
export { DEFAULT_MINIO_CONFIG, DEFAULT_AWS_CONFIG, DEFAULT_R2_CONFIG } from './config/defaults.ts'
export { configFromEnv, hasEnvConfig } from './config/env.ts'

// Presigned types
export type { PresignedUrlOptions, PresignedUrlResult } from './presigned/types.ts'

// Multipart types
export type {
  MultipartCreateResult,
  MultipartUploadPartResult,
  MultipartCompleteResult,
  CompletedPart,
  MultipartListedPart,
  MultipartUploadPartOptions,
} from './multipart/types.ts'
export { MIN_PART_SIZE, MAX_PARTS } from './multipart/types.ts'

// Validation
export { validateSize, validateQuota, SIZE_LIMITS } from './validation/size.ts'
export { validateMimeType, detectMimeType, MIME_TYPES } from './validation/mime.ts'
export { validateExtension, extractExtension, EXTENSIONS } from './validation/extension.ts'
export {
  calculateChecksum,
  calculateStreamChecksum,
  calculateChecksumHex,
} from './validation/checksum.ts'

// Utilities
export { withRetry, calculateDelay, sleep } from './utils/retry.ts'
export type { RetryOptions } from './utils/retry.ts'
export {
  streamToBuffer,
  bufferToStream,
  measureStream,
  chunkStream,
  toReadableStream,
  getBodyLength,
} from './utils/stream.ts'
export {
  formatFileSize,
  getExtension,
  extensionToMime,
  keyToMime,
  normaliseKey,
  joinKey,
  maskSensitive,
} from './utils/format.ts'
export { validateCustom } from './utils/validators.ts'
