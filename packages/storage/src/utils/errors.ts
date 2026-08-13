/**
 * Custom error hierarchy for @abugida/storage.
 *
 * Every error produced by the storage package is an instance of `StorageError`
 * (or one of its subclasses), making it easy to catch and discriminate
 * storage-specific failures in application code.
 */

/** Base error for all storage operations. */
export class StorageError extends Error {
  /** Original cause (if any). */
  public readonly cause?: unknown
  /** Storage key involved in the error (if applicable). */
  public readonly key?: string

  constructor(message: string, options?: { cause?: unknown; key?: string }) {
    super(message)
    this.name = 'StorageError'
    this.cause = options?.cause
    this.key = options?.key
  }
}

/** The requested object does not exist. */
export class StorageNotFoundError extends StorageError {
  constructor(key: string, options?: { cause?: unknown }) {
    super(`Object not found: ${key}`, { cause: options?.cause, key })
    this.name = 'StorageNotFoundError'
  }
}

/** Access was denied by the storage provider. */
export class StorageAccessDeniedError extends StorageError {
  constructor(key: string, options?: { cause?: unknown }) {
    super(`Access denied for key: ${key}`, { cause: options?.cause, key })
    this.name = 'StorageAccessDeniedError'
  }
}

/** An upload operation failed. */
export class StorageUploadError extends StorageError {
  constructor(message: string, options?: { cause?: unknown; key?: string }) {
    super(message, options)
    this.name = 'StorageUploadError'
  }
}

/** A download operation failed. */
export class StorageDownloadError extends StorageError {
  constructor(message: string, options?: { cause?: unknown; key?: string }) {
    super(message, options)
    this.name = 'StorageDownloadError'
  }
}

/** File validation failed before the operation was attempted. */
export class StorageValidationError extends StorageError {
  /** Which validation rule failed. */
  public readonly rule?: string

  constructor(message: string, options?: { cause?: unknown; key?: string; rule?: string }) {
    super(message, options)
    this.name = 'StorageValidationError'
    this.rule = options?.rule
  }
}

/** The operation timed out before completing. */
export class StorageTimeoutError extends StorageError {
  /** Timeout duration in milliseconds. */
  public readonly timeout?: number

  constructor(message: string, options?: { cause?: unknown; key?: string; timeout?: number }) {
    super(message, options)
    this.name = 'StorageTimeoutError'
    this.timeout = options?.timeout
  }
}

/** A conflict occurred (e.g. object already exists with a condition). */
export class StorageConflictError extends StorageError {
  constructor(message: string, options?: { cause?: unknown; key?: string }) {
    super(message, options)
    this.name = 'StorageConflictError'
  }
}

/** A quota was exceeded (e.g. file too large). */
export class StorageQuotaError extends StorageError {
  /** The quota limit that was exceeded. */
  public readonly limit?: number

  constructor(message: string, options?: { cause?: unknown; key?: string; limit?: number }) {
    super(message, options)
    this.name = 'StorageQuotaError'
    this.limit = options?.limit
  }
}

/** A storage key is malformed or invalid. */
export class StorageKeyError extends StorageError {
  constructor(message: string, options?: { cause?: unknown; key?: string }) {
    super(message, options)
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

  return new StorageError(message, { cause: error, key })
}
