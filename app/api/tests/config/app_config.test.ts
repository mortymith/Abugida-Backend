/**
 * @module app_config.test
 * @description Unit tests for the application configuration module.
 */

import { describe, it, expect } from 'bun:test'
import { parseAppConfig } from '@/config/app_config'

function baseEnv(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    BETTER_AUTH_SECRET: 'xK9mP2vL8nQ4wR7jT5hB3cF6gY1sD0aE',
    BETTER_AUTH_URL: 'http://localhost:3000',
    ...overrides,
  }
}

describe('parseAppConfig', () => {
  it('accepts a minimal valid configuration', () => {
    const config = parseAppConfig(baseEnv())
    expect(config).toBeDefined()
    expect(config.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db')
    expect(config.BETTER_AUTH_URL).toBe('http://localhost:3000')
  })

  it('applies default values for optional fields', () => {
    const config = parseAppConfig(baseEnv())
    expect(config.PORT).toBe(3000)
    expect(config.HOST).toBe('0.0.0.0')
    expect(config.LOG_LEVEL).toBe('info')
    expect(config.DATABASE_POOL_MAX).toBe(20)
    expect(config.REDIS_HOST).toBe('localhost')
    expect(config.REDIS_PORT).toBe(6379)
    expect(config.REDIS_DB).toBe(0)
    expect(config.REDIS_TLS).toBe(false)
    expect(config.TRUST_PROXY).toBe(false)
    expect(config.RATE_LIMIT_WINDOW_SECONDS).toBe(60)
    expect(config.RATE_LIMIT_AUTHENTICATED_PER_MINUTE).toBe(100)
    expect(config.RATE_LIMIT_ANONYMOUS_PER_MINUTE).toBe(1000)
    expect(config.ERROR_BASE_URL).toBe('https://api.abugida.com/errors')
    expect(config.HEALTH_CHECK_QUEUE_NAME).toBe('abugida.purchases')
    expect(config.SLOW_REQUEST_THRESHOLD_MS).toBe(1000)
    expect(config.OTEL_SERVICE_NAME).toBe('api')
    expect(config.OTEL_SERVICE_VERSION).toBe('0.0.1')
    expect(config.STORAGE_REGION).toBe('us-east-1')
  })

  it('defaults NODE_ENV to development when unset', () => {
    const config = parseAppConfig(baseEnv())
    expect(config.NODE_ENV).toBe('development')
  })

  it('prefers ENVIRONMENT over NODE_ENV', () => {
    const config = parseAppConfig(baseEnv({ ENVIRONMENT: 'staging', NODE_ENV: 'production' }))
    expect(config.NODE_ENV).toBe('staging')
  })

  it('uses NODE_ENV when ENVIRONMENT is not set', () => {
    const config = parseAppConfig(baseEnv({ NODE_ENV: 'staging' }))
    expect(config.NODE_ENV).toBe('staging')
  })

  it('throws when DATABASE_URL is missing', () => {
    const env = baseEnv()
    delete env.DATABASE_URL
    expect(() => parseAppConfig(env)).toThrow('DATABASE_URL')
  })

  it('throws when DATABASE_URL is not a postgres URL', () => {
    expect(() => parseAppConfig(baseEnv({ DATABASE_URL: 'mysql://localhost/db' }))).toThrow(
      'postgres://',
    )
  })

  it('throws when BETTER_AUTH_SECRET is too short', () => {
    expect(() => parseAppConfig(baseEnv({ BETTER_AUTH_SECRET: 'short' }))).toThrow('32 characters')
  })

  it('throws when BETTER_AUTH_SECRET is a known weak value', () => {
    expect(() =>
      parseAppConfig(baseEnv({ BETTER_AUTH_SECRET: 'change-me-change-me-change-me-change-me' })),
    ).toThrow('well-known placeholder')
  })

  it('throws when BETTER_AUTH_SECRET is a repeated character', () => {
    expect(() =>
      parseAppConfig(baseEnv({ BETTER_AUTH_SECRET: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' })),
    ).toThrow('well-known placeholder')
  })

  it('throws when BETTER_AUTH_URL is not a valid URL', () => {
    expect(() => parseAppConfig(baseEnv({ BETTER_AUTH_URL: 'not-a-url' }))).toThrow('valid URL')
  })

  it('throws when PORT is out of range', () => {
    expect(() => parseAppConfig(baseEnv({ PORT: '99999' }))).toThrow()
  })

  it('throws when DATABASE_POOL_MAX exceeds 100', () => {
    expect(() => parseAppConfig(baseEnv({ DATABASE_POOL_MAX: '101' }))).toThrow()
  })

  it('parses PORT from string to number', () => {
    const config = parseAppConfig(baseEnv({ PORT: '8080' }))
    expect(config.PORT).toBe(8080)
  })

  it('parses boolean env vars correctly', () => {
    expect(parseAppConfig(baseEnv({ REDIS_TLS: 'true' })).REDIS_TLS).toBe(true)
    expect(parseAppConfig(baseEnv({ REDIS_TLS: '1' })).REDIS_TLS).toBe(true)
    expect(parseAppConfig(baseEnv({ REDIS_TLS: 'false' })).REDIS_TLS).toBe(false)
    expect(parseAppConfig(baseEnv({ REDIS_TLS: '0' })).REDIS_TLS).toBe(false)
  })

  it('rejects invalid boolean env vars', () => {
    expect(() => parseAppConfig(baseEnv({ REDIS_TLS: 'yes' }))).toThrow()
  })

  describe('OAuth credential groups', () => {
    it('accepts both Google credentials together', () => {
      const config = parseAppConfig(
        baseEnv({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' }),
      )
      expect(config.GOOGLE_CLIENT_ID).toBe('id')
      expect(config.GOOGLE_CLIENT_SECRET).toBe('secret')
    })

    it('throws when GOOGLE_CLIENT_ID is set without GOOGLE_CLIENT_SECRET', () => {
      expect(() =>
        parseAppConfig(baseEnv({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: undefined })),
      ).toThrow('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together')
    })

    it('throws when GOOGLE_CLIENT_SECRET is set without GOOGLE_CLIENT_ID', () => {
      expect(() =>
        parseAppConfig(baseEnv({ GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: 'secret' })),
      ).toThrow('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together')
    })

    it('accepts all four Apple credentials together', () => {
      const config = parseAppConfig(
        baseEnv({
          APPLE_CLIENT_ID: 'client',
          APPLE_TEAM_ID: '1234567890',
          APPLE_KEY_ID: 'key',
          APPLE_PRIVATE_KEY: 'private',
        }),
      )
      expect(config.APPLE_CLIENT_ID).toBe('client')
      expect(config.APPLE_TEAM_ID).toBe('1234567890')
    })

    it('throws when Apple credentials are incomplete', () => {
      expect(() => parseAppConfig(baseEnv({ APPLE_CLIENT_ID: 'client' }))).toThrow(
        'APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_PRIVATE_KEY must be set together',
      )
    })

    it('throws when APPLE_TEAM_ID is not exactly 10 characters', () => {
      expect(() =>
        parseAppConfig(
          baseEnv({
            APPLE_CLIENT_ID: 'client',
            APPLE_TEAM_ID: 'short',
            APPLE_KEY_ID: 'key',
            APPLE_PRIVATE_KEY: 'private',
          }),
        ),
      ).toThrow('10 characters')
    })
  })

  describe('CORS origins', () => {
    it('accepts valid comma-separated CORS origins', () => {
      const config = parseAppConfig(
        baseEnv({ CORS_ORIGINS: 'https://app.example.com,https://admin.example.com' }),
      )
      expect(config.corsOrigins).toContain('https://app.example.com')
      expect(config.corsOrigins).toContain('https://admin.example.com')
    })

    it('throws on invalid CORS origin URL', () => {
      expect(() => parseAppConfig(baseEnv({ CORS_ORIGINS: 'not-a-url' }))).toThrow(
        'Invalid CORS origin',
      )
    })

    it('deduplicates WEB_APP_URL and CORS_ORIGINS', () => {
      const config = parseAppConfig(
        baseEnv({
          WEB_APP_URL: 'https://app.example.com',
          CORS_ORIGINS: 'https://app.example.com,https://other.com',
        }),
      )
      const origins = config.corsOrigins.filter((o) => o === 'https://app.example.com')
      expect(origins).toHaveLength(1)
    })
  })

  describe('Storage credential groups', () => {
    it('accepts all storage credentials together', () => {
      const config = parseAppConfig(
        baseEnv({
          STORAGE_PROVIDER: 'aws-s3',
          STORAGE_ENDPOINT: 'https://s3.amazonaws.com',
          STORAGE_ACCESS_KEY_ID: 'key',
          STORAGE_SECRET_ACCESS_KEY: 'secret',
          STORAGE_BUCKET: 'bucket',
        }),
      )
      expect(config.STORAGE_PROVIDER).toBe('aws-s3')
    })

    it('throws when STORAGE_PROVIDER is set without credentials', () => {
      expect(() => parseAppConfig(baseEnv({ STORAGE_PROVIDER: 'aws-s3' }))).toThrow(
        'STORAGE_PROVIDER together with',
      )
    })

    it('throws when storage credentials are set without STORAGE_PROVIDER', () => {
      expect(() =>
        parseAppConfig(
          baseEnv({
            STORAGE_ACCESS_KEY_ID: 'key',
            STORAGE_SECRET_ACCESS_KEY: 'secret',
            STORAGE_BUCKET: 'bucket',
          }),
        ),
      ).toThrow('STORAGE_PROVIDER together with')
    })

    it('throws when STORAGE_PROVIDER is set without STORAGE_ENDPOINT', () => {
      expect(() =>
        parseAppConfig(
          baseEnv({
            STORAGE_PROVIDER: 'aws-s3',
            STORAGE_ACCESS_KEY_ID: 'key',
            STORAGE_SECRET_ACCESS_KEY: 'secret',
            STORAGE_BUCKET: 'bucket',
          }),
        ),
      ).toThrow('STORAGE_ENDPOINT is required when STORAGE_PROVIDER is set')
    })
  })

  describe('Production hardening', () => {
    function productionBase(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      return baseEnv({
        NODE_ENV: 'production',
        GOOGLE_CLIENT_ID: 'id',
        GOOGLE_CLIENT_SECRET: 'secret',
        BETTER_AUTH_URL: 'https://auth.example.com',
        WEB_APP_URL: 'https://app.example.com',
        ...overrides,
      })
    }

    it('requires at least one OAuth provider in production', () => {
      const env = productionBase()
      delete env.GOOGLE_CLIENT_ID
      delete env.GOOGLE_CLIENT_SECRET
      expect(() => parseAppConfig(env)).toThrow('At least one OAuth provider')
    })

    it('requires HTTPS for BETTER_AUTH_URL in production', () => {
      expect(() =>
        parseAppConfig(productionBase({ BETTER_AUTH_URL: 'http://auth.example.com' })),
      ).toThrow('https')
    })

    it('requires HTTPS for WEB_APP_URL in production', () => {
      expect(() =>
        parseAppConfig(productionBase({ WEB_APP_URL: 'http://app.example.com' })),
      ).toThrow('https')
    })

    it('requires HTTPS for CORS origins in production', () => {
      expect(() => parseAppConfig(productionBase({ CORS_ORIGINS: 'http://insecure.com' }))).toThrow(
        'https',
      )
    })
  })

  describe('buildCorsOrigins', () => {
    it('includes WEB_APP_URL in corsOrigins', () => {
      const config = parseAppConfig(baseEnv({ WEB_APP_URL: 'https://app.example.com' }))
      expect(config.corsOrigins).toContain('https://app.example.com')
    })

    it('includes CORS_ORIGINS entries in corsOrigins', () => {
      const config = parseAppConfig(baseEnv({ CORS_ORIGINS: 'https://other.com' }))
      expect(config.corsOrigins).toContain('https://other.com')
    })

    it('returns empty array when neither WEB_APP_URL nor CORS_ORIGINS set', () => {
      const config = parseAppConfig(baseEnv())
      expect(config.corsOrigins).toEqual([])
    })

    it('trims whitespace from CORS_ORIGINS entries', () => {
      const config = parseAppConfig(baseEnv({ CORS_ORIGINS: ' https://a.com , https://b.com ' }))
      expect(config.corsOrigins).toContain('https://a.com')
      expect(config.corsOrigins).toContain('https://b.com')
    })
  })

  describe('OTEL defaults', () => {
    it('defaults OTEL_DEPLOYMENT_ENVIRONMENT to NODE_ENV', () => {
      const config = parseAppConfig(baseEnv({ NODE_ENV: 'staging' }))
      expect(config.OTEL_DEPLOYMENT_ENVIRONMENT).toBe('staging')
    })

    it('uses explicit OTEL_DEPLOYMENT_ENVIRONMENT when set', () => {
      const config = parseAppConfig(baseEnv({ OTEL_DEPLOYMENT_ENVIRONMENT: 'custom' }))
      expect(config.OTEL_DEPLOYMENT_ENVIRONMENT).toBe('custom')
    })

    it('defaults OTEL_EXPORTER_OTLP_ENDPOINT', () => {
      const config = parseAppConfig(baseEnv())
      expect(config.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('http://localhost:4318')
    })
  })
})
