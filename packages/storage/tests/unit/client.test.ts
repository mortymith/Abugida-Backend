/**
 * Unit tests for the S3 client module.
 */

import { describe, it, expect } from 'vitest'
import { validateConfig, PROVIDER_DEFAULTS } from '../../src/config/schema.ts'

describe('validateConfig', () => {
  const baseConfig = {
    provider: 'minio' as const,
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    bucket: 'test-bucket',
  }

  it('should apply defaults to a valid config', () => {
    const result = validateConfig(baseConfig)
    expect(result.forcePathStyle).toBe(true) // MinIO default
    expect(result.maxAttempts).toBe(3)
    expect(result.requestTimeout).toBe(30_000)
    expect(result.connectionTimeout).toBe(5_000)
    expect(result.retryStrategy?.backoff).toBe('adaptive')
    expect(result.encryption?.enabled).toBe(false)
    expect(result.logging?.level).toBe('warn')
    expect(result.quotas?.maxFileSize).toBe(5120)
  })

  it('should throw on invalid provider', () => {
    expect(() => validateConfig({ ...baseConfig, provider: 'invalid' as any })).toThrow(
      'Invalid provider',
    )
  })

  it('should throw on missing accessKeyId', () => {
    expect(() => validateConfig({ ...baseConfig, accessKeyId: '' })).toThrow(
      '"accessKeyId" is required',
    )
  })

  it('should throw on missing bucket', () => {
    expect(() => validateConfig({ ...baseConfig, bucket: '' })).toThrow('"bucket" is required')
  })

  it('should throw when aws:kms is used without keyId', () => {
    expect(() =>
      validateConfig({
        ...baseConfig,
        encryption: { enabled: true, algorithm: 'aws:kms' },
      }),
    ).toThrow('"encryption.keyId" is required')
  })

  it('should accept aws:kms with a keyId', () => {
    const result = validateConfig({
      ...baseConfig,
      encryption: { enabled: true, algorithm: 'aws:kms', keyId: 'arn:aws:kms:...' },
    })
    expect(result.encryption?.algorithm).toBe('aws:kms')
  })

  it('should throw on invalid maxFileSize', () => {
    expect(() => validateConfig({ ...baseConfig, quotas: { maxFileSize: 0 } })).toThrow(
      '"quotas.maxFileSize" must be > 0',
    )
  })

  it('should preserve user overrides', () => {
    const result = validateConfig({
      ...baseConfig,
      maxAttempts: 7,
      forcePathStyle: false,
      requestTimeout: 60_000,
    })
    expect(result.maxAttempts).toBe(7)
    expect(result.forcePathStyle).toBe(false)
    expect(result.requestTimeout).toBe(60_000)
  })
})

describe('PROVIDER_DEFAULTS', () => {
  it('should have defaults for all providers', () => {
    const providers = ['aws-s3', 'minio', 'r2', 'spaces', 'wasabi', 'b2'] as const
    for (const provider of providers) {
      expect(PROVIDER_DEFAULTS[provider]).toBeDefined()
      expect(typeof PROVIDER_DEFAULTS[provider].forcePathStyle).toBe('boolean')
    }
  })

  it('should set forcePathStyle true for MinIO', () => {
    expect(PROVIDER_DEFAULTS.minio.forcePathStyle).toBe(true)
  })

  it('should set forcePathStyle false for AWS S3', () => {
    expect(PROVIDER_DEFAULTS['aws-s3'].forcePathStyle).toBe(false)
  })
})
