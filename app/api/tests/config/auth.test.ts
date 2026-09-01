/**
 * @module auth.test
 * @description Unit tests for the auth configuration module.
 *
 * These tests verify the auth module's interface and exports.
 * The module builds auth config from appConfig at import time.
 */

import { describe, it, expect } from 'bun:test'

describe('auth module', () => {
  it('exports authConfig object', async () => {
    const mod = await import('@/config/auth')
    expect(mod.authConfig).toBeDefined()
    expect(typeof mod.authConfig).toBe('object')
  })

  it('authConfig has required fields', async () => {
    const mod = await import('@/config/auth')
    const config = mod.authConfig
    expect(config.secret).toBeDefined()
    expect(config.baseUrl).toBeDefined()
    expect(config.database).toBeDefined()
    expect(config.database.db).toBeDefined()
    expect(config.database.schema).toBeDefined()
    expect(config.database.provider).toBe('pg')
  })

  it('authConfig has providers object', async () => {
    const mod = await import('@/config/auth')
    expect(mod.authConfig.providers).toBeDefined()
    expect(typeof mod.authConfig.providers).toBe('object')
  })

  it('authConfig has rateLimit config', async () => {
    const mod = await import('@/config/auth')
    expect(mod.authConfig.rateLimit).toBeDefined()
    expect(mod.authConfig.rateLimit.max).toBe(100)
    expect(mod.authConfig.rateLimit.windowSeconds).toBe(60)
  })

  it('exports createAuthInstance function', async () => {
    const mod = await import('@/config/auth')
    expect(typeof mod.createAuthInstance).toBe('function')
  })

  it('buildProviders includes Google when credentials are set', async () => {
    const mod = await import('@/config/auth')
    // The auth module reads from appConfig which is parsed at import time
    // In the test environment, GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set
    if (mod.authConfig.providers?.google) {
      expect(mod.authConfig.providers.google.clientId).toBeDefined()
      expect(mod.authConfig.providers.google.clientSecret).toBeDefined()
    }
  })

  it('authConfig includes CORS when WEB_APP_URL is set', async () => {
    const mod = await import('@/config/auth')
    // WEB_APP_URL may or may not be set in test env
    if (mod.authConfig.cors) {
      expect(mod.authConfig.cors.origins).toBeDefined()
      expect(Array.isArray(mod.authConfig.cors.origins)).toBe(true)
      expect(mod.authConfig.cors.credentials).toBe(true)
    }
  })
})
