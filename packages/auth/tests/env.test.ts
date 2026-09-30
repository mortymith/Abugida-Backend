import { describe, expect, it } from 'bun:test'
import {
  authEnvSchema,
  buildTrustedOrigins,
  parseAuthEnvironment,
  resolveAuthEnv,
} from '../src/config/env'

const validEnv = {
  ENVIRONMENT: 'test',
  BETTER_AUTH_SECRET: '8b1f4c2d9e7a6f3b5c0d1e2a4b6c8d0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2',
  BETTER_AUTH_URL: 'https://api.abugida.app',
  GOOGLE_CLIENT_ID: 'id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'google-secret',
}

describe('auth env contract', () => {
  it('applies the shared defaults', () => {
    const env = resolveAuthEnv(validEnv)

    expect(env.environment).toBe('test')
    expect(env.basePath).toBe('/auth')
    expect(env.baseUrl).toBe('https://api.abugida.app')
    expect(env.rateLimit).toEqual({ max: 100, windowSeconds: 60 })
    expect(env.twoFactor).toEqual({
      issuer: 'Abugida Academy',
      twoFactorCookieMaxAge: 600,
      trustDeviceMaxAge: 2_592_000,
      accountLockout: { maxFailedAttempts: 5, durationSeconds: 900 },
    })
    expect(env.organization.allowUserToCreateOrganization).toBe(true)
  })

  it('maps a deployment environment onto the auth environment', () => {
    expect(resolveAuthEnv({ ...validEnv, ENVIRONMENT: 'development' }).environment).toBe(
      'development',
    )
    // Staging serves over https, so it gets production cookie flags.
    expect(resolveAuthEnv({ ...validEnv, ENVIRONMENT: 'staging' }).environment).toBe('production')
    expect(
      resolveAuthEnv({
        BETTER_AUTH_URL: validEnv.BETTER_AUTH_URL,
        BETTER_AUTH_SECRET: validEnv.BETTER_AUTH_SECRET,
        NODE_ENV: 'production',
      }).environment,
    ).toBe('production')
    expect(parseAuthEnvironment(undefined)).toBe('development')
  })

  it('treats blank strings as unset so an empty .env value is not a credential', () => {
    const env = resolveAuthEnv({ ...validEnv, GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' })
    expect(env.providers.google).toBeUndefined()
  })

  it('rejects a half-configured OAuth provider pair', () => {
    const result = authEnvSchema.safeParse({ ...validEnv, GOOGLE_CLIENT_SECRET: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain('GOOGLE_CLIENT_ID')
  })

  it('rejects a placeholder secret that is long enough to pass a length check', () => {
    const result = authEnvSchema.safeParse({
      ...validEnv,
      BETTER_AUTH_SECRET: 'changemechangemechangemechangeme',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a secret shorter than 32 characters', () => {
    expect(authEnvSchema.safeParse({ ...validEnv, BETTER_AUTH_SECRET: 'short' }).success).toBe(
      false,
    )
  })

  it('rejects a base path that does not start with a slash', () => {
    expect(authEnvSchema.safeParse({ ...validEnv, AUTH_BASE_PATH: 'auth' }).success).toBe(false)
  })

  it('always requests the Telegram phone scope from the server side', () => {
    const env = resolveAuthEnv({
      ...validEnv,
      TELEGRAM_OIDC_CLIENT_ID: '123456789',
      TELEGRAM_OIDC_CLIENT_SECRET: 'shh-its-a-secret',
    })

    expect(env.providers.telegram).toEqual({
      clientId: '123456789',
      clientSecret: 'shh-its-a-secret',
      requestPhone: true,
    })
  })

  it('builds one deduplicated trusted-origin list for CORS and better-auth', () => {
    const env = resolveAuthEnv({
      ...validEnv,
      WEB_APP_URL: 'https://app.abugida.app',
      CORS_ORIGINS: 'https://app.abugida.app, https://beta.abugida.app',
    })

    expect(env.trustedOrigins).toEqual([
      'https://api.abugida.app',
      'https://app.abugida.app',
      'https://beta.abugida.app',
    ])
  })

  it('trusts the auth origin even when no browser app is configured', () => {
    expect(buildTrustedOrigins({ authUrl: 'http://localhost:3001' })).toEqual([
      'http://localhost:3001',
    ])
  })

  it('omits token issuance unless an audience is configured', () => {
    expect(resolveAuthEnv(validEnv).tokens).toBeUndefined()
    expect(resolveAuthEnv({ ...validEnv, TOKEN_AUDIENCE: 'powersync' }).tokens).toEqual({
      audience: 'powersync',
    })
  })

  it('honours an explicit user-created-organization policy', () => {
    const env = resolveAuthEnv({
      ...validEnv,
      AUTH_ALLOW_USER_CREATED_ORGANIZATIONS: 'false',
    })
    expect(env.organization.allowUserToCreateOrganization).toBe(false)
  })
})
