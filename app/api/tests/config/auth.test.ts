/**
 * @module auth.test
 * @description Unit tests for the API's auth wiring.
 *
 * The auth policy itself (instance, plugin registry, session/security
 * settings, database binding) is owned by `@abugida/auth` and tested there.
 * What matters here is that the API builds exactly one instance from that
 * package and hands it around unchanged.
 */

import { beforeAll, describe, it, expect } from 'bun:test'

describe('auth module', () => {
  beforeAll(async () => {
    // The auth instance logs through the shared observability logger, which
    // requires init() — the same order app.ts uses.
    const { init } = await import('@/config/observability')
    await init()
  })
  it('exports createAuthInstance function', async () => {
    const mod = await import('@/config/auth')
    expect(typeof mod.createAuthInstance).toBe('function')
  })

  it('builds exactly one instance per process', async () => {
    const mod = await import('@/config/auth')
    expect(mod.createAuthInstance()).toBe(mod.createAuthInstance())
  })

  it('resolves the configuration from the shared auth package', async () => {
    const { createAuthInstance } = await import('@/config/auth')
    const { config, api, db } = createAuthInstance()

    expect(config.secret).toBeDefined()
    expect(config.baseUrl).toBeDefined()
    expect(config.database.provider).toBe('pg')
    expect(config.database.db).toBeDefined()
    // Bound from @abugida/database — the app never declares these tables.
    expect(config.database.schema).toHaveProperty('user')
    expect(config.database.schema).toHaveProperty('session')
    expect(config.database.schema).toHaveProperty('organization')

    expect(typeof config.providers).toBe('object')
    expect(config.rateLimit.max).toBe(100)
    expect(config.rateLimit.windowSeconds).toBe(60)
    expect(config.cors?.credentials).toBe(true)
    expect(Array.isArray(config.cors?.origins)).toBe(true)

    // Exposes better-auth's server API and the Drizzle handle the shared
    // authorization helpers need.
    expect(api).toBeDefined()
    expect(db).toBeDefined()
  })

  it('serves the same plugin surface as the dashboard', async () => {
    const { createAuthInstance } = await import('@/config/auth')
    const { api } = createAuthInstance() as unknown as {
      api: Record<string, unknown>
    }

    // Organizations and two-factor are registered by @abugida/auth, not here.
    expect(api.getActiveMember).toBeDefined()
    expect(api.createOrganization).toBeDefined()
    expect(api.listMembers).toBeDefined()
    expect(api.verifyTOTP).toBeDefined()
    expect(api.verifyBackupCode).toBeDefined()
  })

  it('mounts the auth endpoints with backend-owned social sign-in policy', async () => {
    // Redirect destinations are app configuration, not request data: the
    // shared mount replaces the client's body (see
    // `SocialSignInPolicy` in @abugida/auth and its tests).
    const { registerAuthRoutePolicy } = await import('@/app')
    expect(typeof registerAuthRoutePolicy).toBe('function')

    const policy = registerAuthRoutePolicy()
    expect(policy.socialSignIn?.callbackURL).toBeDefined()
    expect(policy.socialSignIn?.providerAliases).toEqual({ telegram: 'telegram-oidc' })
    expect(policy.telegramConfig).toEqual({ providerId: 'telegram' })
  })
})
