/**
 * Unit tests for environment configuration.
 */

import { describe, test, expect } from 'bun:test'
import { configFromEnv, hasEnvConfig } from '../../src/config/env.ts'

describe('configFromEnv', () => {
  const validEnv = {
    STORAGE_PROVIDER: 'minio',
    STORAGE_ENDPOINT: 'http://localhost:9000',
    STORAGE_REGION: 'us-east-1',
    STORAGE_ACCESS_KEY_ID: 'test-key',
    STORAGE_SECRET_ACCESS_KEY: 'test-secret',
    STORAGE_BUCKET: 'test-bucket',
  }

  test('builds config from valid environment', () => {
    const config = configFromEnv(validEnv)
    expect(config.provider).toBe('minio')
    expect(config.endpoint).toBe('http://localhost:9000')
    expect(config.region).toBe('us-east-1')
    expect(config.accessKeyId).toBe('test-key')
    expect(config.secretAccessKey).toBe('test-secret')
    expect(config.bucket).toBe('test-bucket')
  })

  test('throws on missing provider', () => {
    expect(() => configFromEnv({})).toThrow('STORAGE_PROVIDER')
  })

  test('throws on missing access key', () => {
    expect(() => configFromEnv({ STORAGE_PROVIDER: 'minio' })).toThrow('STORAGE_ACCESS_KEY_ID')
  })

  test('parses numeric options', () => {
    const config = configFromEnv({
      ...validEnv,
      STORAGE_MAX_ATTEMPTS: '5',
      STORAGE_REQUEST_TIMEOUT: '60000',
    })
    expect(config.maxAttempts).toBe(5)
    expect(config.requestTimeout).toBe(60000)
  })

  test('parses boolean forcePathStyle', () => {
    const config = configFromEnv({
      ...validEnv,
      STORAGE_FORCE_PATH_STYLE: 'true',
    })
    expect(config.forcePathStyle).toBe(true)
  })
})

describe('hasEnvConfig', () => {
  test('returns true when all required vars are present', () => {
    expect(
      hasEnvConfig({
        STORAGE_PROVIDER: 'minio',
        STORAGE_ACCESS_KEY_ID: 'key',
        STORAGE_SECRET_ACCESS_KEY: 'secret',
        STORAGE_BUCKET: 'bucket',
      }),
    ).toBe(true)
  })

  test('returns false when vars are missing', () => {
    expect(hasEnvConfig({})).toBe(false)
  })
})
