/**
 * @module api-key-auth.middleware.test
 * @description Unit tests for the API key authentication middleware.
 */

import { Hono } from 'hono'
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import type { AppEnv, ResolvedApiKey } from '@/middleware/types'

function mockDb(options: { findKey?: any; updateCalled?: { value: boolean } }) {
  const updateState = options.updateCalled ?? { value: false }
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(options.findKey ? [options.findKey] : []),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => {
          updateState.value = true
          return Promise.resolve()
        },
      }),
    }),
  }
}

describe('apiKeyAuthMiddleware', () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  it('returns 401 when X-API-Key header is missing', async () => {
    const { apiKeyAuthMiddleware } = await import('@/middleware/api-key-auth.middleware')
    const app = new Hono<AppEnv>()
    const db = mockDb({ findKey: null }) as any

    app.use('*', apiKeyAuthMiddleware(db))
    app.get('/webhooks/test', (c) => c.text('ok'))

    const res = await app.request('/webhooks/test')
    expect(res.status).toBe(401)

    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      type: 'https://api.abugida.com/errors/unauthorized',
      status: 401,
      detail: 'Missing X-API-Key header.',
    })
  })

  it('returns 401 when API key is not found in database', async () => {
    const { apiKeyAuthMiddleware } = await import('@/middleware/api-key-auth.middleware')
    const app = new Hono<AppEnv>()
    const db = mockDb({ findKey: null }) as any

    app.use('*', apiKeyAuthMiddleware(db))
    app.get('/webhooks/test', (c) => c.text('ok'))

    const res = await app.request('/webhooks/test', {
      headers: { 'X-API-Key': 'invalid-key' },
    })
    expect(res.status).toBe(401)

    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      detail: 'Invalid API key.',
    })
  })

  it('returns 401 when API key is expired', async () => {
    const { apiKeyAuthMiddleware } = await import('@/middleware/api-key-auth.middleware')
    const app = new Hono<AppEnv>()
    const expiredKey = {
      publicId: 'pk-expired',
      name: 'Expired Key',
      userId: 1,
      scopes: ['webhooks'],
      rateLimit: 100,
      keyPrefix: 'wh',
      expiresAt: new Date(Date.now() - 1000),
      isActive: true,
    }
    const db = mockDb({ findKey: expiredKey }) as any

    app.use('*', apiKeyAuthMiddleware(db))
    app.get('/webhooks/test', (c) => c.text('ok'))

    const res = await app.request('/webhooks/test', {
      headers: { 'X-API-Key': 'expired-key' },
    })
    expect(res.status).toBe(401)

    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      detail: 'API key has expired.',
    })
  })

  it('sets apiKey in context and proceeds with valid key', async () => {
    const { apiKeyAuthMiddleware } = await import('@/middleware/api-key-auth.middleware')
    const app = new Hono<AppEnv>()
    const validKey = {
      publicId: 'pk-valid',
      name: 'Valid Key',
      userId: 42,
      scopes: ['webhooks', 'payments'],
      rateLimit: 100,
      keyPrefix: 'wh',
      expiresAt: new Date(Date.now() + 86400000),
      isActive: true,
    }
    const db = mockDb({ findKey: validKey }) as any

    app.use('*', apiKeyAuthMiddleware(db))
    app.get('/webhooks/test', (c) => {
      const apiKey = c.get('apiKey')
      return c.json({ apiKey })
    })

    const res = await app.request('/webhooks/test', {
      headers: { 'X-API-Key': 'valid-key' },
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { apiKey: ResolvedApiKey }
    expect(body.apiKey).toEqual({
      publicId: 'pk-valid',
      name: 'Valid Key',
      userId: 42,
      scopes: ['webhooks', 'payments'],
      rateLimit: 100,
      keyPrefix: 'wh',
    })
  })

  it('handles key with no expiration', async () => {
    const { apiKeyAuthMiddleware } = await import('@/middleware/api-key-auth.middleware')
    const app = new Hono<AppEnv>()
    const noExpiryKey = {
      publicId: 'pk-no-expiry',
      name: 'No Expiry Key',
      userId: 1,
      scopes: [],
      rateLimit: 100,
      keyPrefix: 'wh',
      expiresAt: null,
      isActive: true,
    }
    const db = mockDb({ findKey: noExpiryKey }) as any

    app.use('*', apiKeyAuthMiddleware(db))
    app.get('/webhooks/test', (c) => c.text('ok'))

    const res = await app.request('/webhooks/test', {
      headers: { 'X-API-Key': 'no-expiry-key' },
    })
    expect(res.status).toBe(200)
  })

  it('handles key with non-array scopes', async () => {
    const { apiKeyAuthMiddleware } = await import('@/middleware/api-key-auth.middleware')
    const app = new Hono<AppEnv>()
    const keyWithBadScopes = {
      publicId: 'pk-bad-scopes',
      name: 'Bad Scopes',
      userId: 1,
      scopes: 'not-an-array',
      rateLimit: 100,
      keyPrefix: 'wh',
      expiresAt: null,
      isActive: true,
    }
    const db = mockDb({ findKey: keyWithBadScopes }) as any

    app.use('*', apiKeyAuthMiddleware(db))
    app.get('/webhooks/test', (c) => {
      const apiKey = c.get('apiKey')
      return c.json({ scopes: apiKey?.scopes })
    })

    const res = await app.request('/webhooks/test', {
      headers: { 'X-API-Key': 'bad-scopes-key' },
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { scopes: string[] }
    expect(body.scopes).toEqual([])
  })
})
