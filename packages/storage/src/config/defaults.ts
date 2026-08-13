/**
 * Default configuration values for @abugida/storage.
 */

import type { StorageConfig } from '../core/types.ts'

/** Sensible defaults for local MinIO development. */
export const DEFAULT_MINIO_CONFIG: Partial<StorageConfig> = {
  provider: 'minio',
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  forcePathStyle: true,
  maxAttempts: 3,
  requestTimeout: 30_000,
  connectionTimeout: 5_000,
  retryStrategy: {
    maxAttempts: 3,
    backoff: 'adaptive',
    baseDelay: 200,
    maxDelay: 10_000,
  },
  encryption: { enabled: false },
  logging: {
    level: 'warn',
    format: 'json',
    sensitiveDataMasking: true,
  },
  quotas: { maxFileSize: 5120 },
}

/** Defaults for AWS S3 in production. */
export const DEFAULT_AWS_CONFIG: Partial<StorageConfig> = {
  provider: 'aws-s3',
  endpoint: 'https://s3.amazonaws.com',
  region: 'us-east-1',
  forcePathStyle: false,
  maxAttempts: 5,
  requestTimeout: 30_000,
  connectionTimeout: 5_000,
  retryStrategy: {
    maxAttempts: 5,
    backoff: 'adaptive',
    baseDelay: 200,
    maxDelay: 20_000,
  },
  encryption: { enabled: true, algorithm: 'AES256' },
  logging: {
    level: 'info',
    format: 'json',
    sensitiveDataMasking: true,
  },
  quotas: { maxFileSize: 5120 },
}

/** Defaults for Cloudflare R2. */
export const DEFAULT_R2_CONFIG: Partial<StorageConfig> = {
  provider: 'r2',
  region: 'auto',
  forcePathStyle: false,
  maxAttempts: 3,
  requestTimeout: 30_000,
  connectionTimeout: 5_000,
  retryStrategy: {
    maxAttempts: 3,
    backoff: 'adaptive',
    baseDelay: 200,
    maxDelay: 10_000,
  },
  encryption: { enabled: false },
  logging: {
    level: 'warn',
    format: 'json',
    sensitiveDataMasking: true,
  },
  quotas: { maxFileSize: 5120 },
}
