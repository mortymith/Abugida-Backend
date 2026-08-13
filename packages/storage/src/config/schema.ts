/**
 * Configuration schema and validation for @abugida/storage.
 */

import type { StorageConfig, StorageProvider, BackoffStrategy } from '../core/types.ts'

// ---------------------------------------------------------------------------
// Provider defaults
// ---------------------------------------------------------------------------

/** Provider-specific default settings. */
export const PROVIDER_DEFAULTS: Record<
  StorageProvider,
  {
    forcePathStyle: boolean
    defaultRegion: string
    defaultEndpoint: string
  }
> = {
  'aws-s3': {
    forcePathStyle: false,
    defaultRegion: 'us-east-1',
    defaultEndpoint: 'https://s3.amazonaws.com',
  },
  minio: {
    forcePathStyle: true,
    defaultRegion: 'us-east-1',
    defaultEndpoint: 'http://localhost:9000',
  },
  r2: {
    forcePathStyle: false,
    defaultRegion: 'auto',
    defaultEndpoint: '',
  },
  spaces: {
    forcePathStyle: false,
    defaultRegion: 'nyc3',
    defaultEndpoint: '',
  },
  wasabi: {
    forcePathStyle: false,
    defaultRegion: 'us-east-1',
    defaultEndpoint: 'https://s3.wasabisys.com',
  },
  b2: {
    forcePathStyle: false,
    defaultRegion: 'us-west-002',
    defaultEndpoint: 'https://s3.us-west-002.backblazeb2.com',
  },
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_PROVIDERS: StorageProvider[] = ['aws-s3', 'minio', 'r2', 'spaces', 'wasabi', 'b2']

const VALID_BACKOFF: BackoffStrategy[] = ['exponential', 'fixed', 'adaptive']

/**
 * Validate and normalise a `StorageConfig`.
 *
 * @throws {Error} when required fields are missing or values are invalid.
 * @returns A normalised copy with defaults applied.
 */
export function validateConfig(config: StorageConfig): StorageConfig {
  if (!VALID_PROVIDERS.includes(config.provider)) {
    throw new Error(
      `Invalid provider: "${config.provider}". Expected one of: ${VALID_PROVIDERS.join(', ')}`,
    )
  }

  if (!config.endpoint && !PROVIDER_DEFAULTS[config.provider].defaultEndpoint) {
    throw new Error(
      `"endpoint" is required for provider "${config.provider}" (no default available).`,
    )
  }

  if (!config.region) {
    throw new Error('"region" is required.')
  }

  if (!config.accessKeyId) {
    throw new Error('"accessKeyId" is required.')
  }

  if (!config.secretAccessKey) {
    throw new Error('"secretAccessKey" is required.')
  }

  if (!config.bucket) {
    throw new Error('"bucket" is required.')
  }

  // Retry strategy validation
  if (config.retryStrategy) {
    if (config.retryStrategy.maxAttempts < 0) {
      throw new Error('"retryStrategy.maxAttempts" must be >= 0.')
    }
    if (!VALID_BACKOFF.includes(config.retryStrategy.backoff)) {
      throw new Error(
        `Invalid backoff: "${config.retryStrategy.backoff}". Expected one of: ${VALID_BACKOFF.join(', ')}`,
      )
    }
    if (config.retryStrategy.baseDelay !== undefined && config.retryStrategy.baseDelay < 0) {
      throw new Error('"retryStrategy.baseDelay" must be >= 0.')
    }
    if (config.retryStrategy.maxDelay !== undefined && config.retryStrategy.maxDelay < 0) {
      throw new Error('"retryStrategy.maxDelay" must be >= 0.')
    }
  }

  // Encryption validation
  if (config.encryption?.algorithm === 'aws:kms' && !config.encryption.keyId) {
    throw new Error('"encryption.keyId" is required when algorithm is "aws:kms".')
  }

  // Quotas validation
  if (config.quotas && config.quotas.maxFileSize <= 0) {
    throw new Error('"quotas.maxFileSize" must be > 0.')
  }

  return applyDefaults(config)
}

// ---------------------------------------------------------------------------
// Default application
// ---------------------------------------------------------------------------

function applyDefaults(config: StorageConfig): StorageConfig {
  const providerDefaults = PROVIDER_DEFAULTS[config.provider]

  return {
    ...config,
    endpoint: config.endpoint || providerDefaults.defaultEndpoint,
    forcePathStyle: config.forcePathStyle ?? providerDefaults.forcePathStyle,
    maxAttempts: config.maxAttempts ?? 3,
    requestTimeout: config.requestTimeout ?? 30_000,
    connectionTimeout: config.connectionTimeout ?? 5_000,
    retryStrategy: {
      maxAttempts: 3,
      backoff: 'adaptive',
      baseDelay: 200,
      maxDelay: 10_000,
      ...config.retryStrategy,
    },
    encryption: config.encryption ?? { enabled: false },
    logging: {
      level: 'warn',
      format: 'json',
      sensitiveDataMasking: true,
      ...config.logging,
    },
    quotas: config.quotas ?? { maxFileSize: 5120 }, // 5 GB default
  }
}
