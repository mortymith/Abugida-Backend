/**
 * Custom error hierarchy for @abugida/storage.
 *
 * Every error produced by the storage package is an instance of `StorageError`
 * (or one of its subclasses), making it easy to catch and discriminate
 * storage-specific failures in application code.
 *
 * Every error also carries a stable, machine-readable `code`
 * (SCREAMING_SNAKE_CASE), so consumers can branch on the failure kind without
 * relying on `instanceof`:
 *
 * ```ts
 * if (error instanceof StorageError && error.code === 'NOT_FOUND') { ... }
 * ```
 */

/** Base error for all storage operations. */
export class StorageError extends Error {
  /** Stable, machine-readable failure kind. */
  public readonly code: string
  /** Original cause (if any). */
  public override readonly cause?: unknown
  /** Storage key involved in the error (if applicable). */
  public readonly key?: string

  constructor(message: string, code: string, options?: { cause?: unknown; key?: string }) {
    super(message)
    this.name = 'StorageError'
    this.code = code
    this.cause = options?.cause
    this.key = options?.key
  }
}

/** The requested object does not exist. */
export class StorageNotFoundError extends StorageError {
  constructor(key: string, options?: { cause?: unknown }) {
    super(`Object not found: ${key}`, 'NOT_FOUND', { cause: options?.cause, key })
    this.name = 'StorageNotFoundError'
  }
}

/** Access was denied by the storage provider. */
export class StorageAccessDeniedError extends StorageError {
  constructor(key: string, options?: { cause?: unknown }) {
    super(`Access denied for key: ${key}`, 'ACCESS_DENIED', { cause: options?.cause, key })
    this.name = 'StorageAccessDeniedError'
  }
}

/** An upload operation failed. */
export class StorageUploadError extends StorageError {
  constructor(message: string, options?: { cause?: unknown; key?: string }) {
    super(message, 'UPLOAD_FAILED', options)
    this.name = 'StorageUploadError'
  }
}

/** A download operation failed. */
export class StorageDownloadError extends StorageError {
  constructor(message: string, options?: { cause?: unknown; key?: string }) {
    super(message, 'DOWNLOAD_FAILED', options)
    this.name = 'StorageDownloadError'
  }
}

/** File validation failed before the operation was attempted. */
export class StorageValidationError extends StorageError {
  /** Which validation rule failed. */
  public readonly rule?: string

  constructor(message: string, options?: { cause?: unknown; key?: string; rule?: string }) {
    super(message, 'VALIDATION_FAILED', options)
    this.name = 'StorageValidationError'
    this.rule = options?.rule
  }
}

/** The operation timed out before completing. */
export class StorageTimeoutError extends StorageError {
  /** Timeout duration in milliseconds. */
  public readonly timeout?: number

  constructor(message: string, options?: { cause?: unknown; key?: string; timeout?: number }) {
    super(message, 'TIMEOUT', options)
    this.name = 'StorageTimeoutError'
    this.timeout = options?.timeout
  }
}

/** A conflict occurred (e.g. object already exists with a condition). */
export class StorageConflictError extends StorageError {
  constructor(message: string, options?: { cause?: unknown; key?: string }) {
    super(message, 'CONFLICT', options)
    this.name = 'StorageConflictError'
  }
}

/** A quota was exceeded (e.g. file too large). */
export class StorageQuotaError extends StorageError {
  /** The quota limit that was exceeded. */
  public readonly limit?: number

  constructor(message: string, options?: { cause?: unknown; key?: string; limit?: number }) {
    super(message, 'QUOTA_EXCEEDED', options)
    this.name = 'StorageQuotaError'
    this.limit = options?.limit
  }
}

/** A storage key is malformed or invalid. */
export class StorageKeyError extends StorageError {
  constructor(message: string, options?: { cause?: unknown; key?: string }) {
    super(message, 'INVALID_KEY', options)
    this.name = 'StorageKeyError'
  }
}

// ---------------------------------------------------------------------------
// Error classification helper
// ---------------------------------------------------------------------------

/**
 * Map an AWS SDK error to the appropriate `StorageError` subclass.
 * Falls back to a generic `StorageError` when no specific mapping applies.
 */
export function classifyError(error: unknown, key?: string): StorageError {
  if (error instanceof StorageError) return error

  const awsError = error as
    { name?: string; message?: string; $metadata?: { httpStatusCode?: number } } | undefined
  const name = awsError?.name ?? ''
  const statusCode = awsError?.$metadata?.httpStatusCode
  const message = awsError?.message ?? 'Unknown storage error'

  if (name === 'NoSuchKey' || statusCode === 404) {
    return new StorageNotFoundError(key ?? 'unknown', { cause: error })
  }
  if (name === 'AccessDenied' || statusCode === 403) {
    return new StorageAccessDeniedError(key ?? 'unknown', { cause: error })
  }
  if (name === 'TimeoutError' || name === 'ConnectionTimeoutError' || statusCode === 504) {
    return new StorageTimeoutError(message, { cause: error, key })
  }
  if (statusCode === 409) {
    return new StorageConflictError(message, { cause: error, key })
  }
  if (statusCode === 413) {
    return new StorageQuotaError(message, { cause: error, key })
  }

  return new StorageError(message, 'STORAGE_ERROR', { cause: error, key })
}
