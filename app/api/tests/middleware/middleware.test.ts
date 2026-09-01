/**
 * @module middleware.test
 *
 * Unit tests for the API middleware stack. Each test builds a minimal Hono
 * app with the middleware under test and drives it via `app.request()`, so no
 * live database, Redis, auth instance or network is required.
 */

import { Hono } from 'hono'
import { describe, expect, it } from 'bun:test'
import { HTTPException } from 'hono/http-exception'
import { appConfig } from '@/config/app_config'
import { createMemoryRateLimiter, type RateLimiters } from '@/config/rate-limit'
import { requestIdMiddleware, uuidv7 } from '@/middleware/request-id.middleware'
import { corsMiddleware } from '@/middleware/cors.middleware'
import { errorHandler, notFoundHandler } from '@/middleware/error-handler.middleware'
import { rateLimitMiddleware } from '@/middleware/rate-limit.middleware'
import type { AppEnv } from '@/middleware/types'

const UUIDV7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('uuidv7', () => {
  it('produces spec-conformant UUID v7 ids', () => {
    expect(uuidv7()).toMatch(UUIDV7_PATTERN)
  })

  it('produces distinct ids', () => {
    expect(uuidv7()).not.toBe(uuidv7())
  })
})

describe('requestIdMiddleware', () => {
  function makeApp(): Hono<AppEnv> {
    const app = new Hono<AppEnv>()
    app.use('*', requestIdMiddleware())
    app.get('/x', (c) => c.json({ requestId: c.get('requestId') }))
    return app
  }

  it('generates a UUID v7 id and echoes it in the response header', async () => {
    const res = await makeApp().request('/x')
    const header = res.headers.get('X-Request-ID')
    expect(header).toMatch(UUIDV7_PATTERN)
    expect(header).not.toBeNull()

    const body = (await res.json()) as { requestId: string }
    expect(body.requestId).toBe(header!)
  })

  it('honors a well-formed incoming X-Request-ID', async () => {
    const incoming = uuidv7()
    const res = await makeApp().request('/x', { headers: { 'X-Request-ID': incoming } })
    expect(res.headers.get('X-Request-ID')).toBe(incoming)
  })
})

describe('errorHandler', () => {
  it('returns 404 problem+json for unknown routes', async () => {
    const app = new Hono<AppEnv>()
    app.notFound(notFoundHandler())

    const res = await app.request('/missing')
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/problem+json')

    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      type: 'https://api.abugida.com/errors/not-found',
      status: 404,
      instance: 'http://localhost/missing',
    })
  })

  it('maps HTTPException to its status code', async () => {
    const app = new Hono<AppEnv>()
    app.onError(errorHandler())
    app.get('/conflict', () => {
      throw new HTTPException(409, { message: 'Duplicate resource.' })
    })

    const res = await app.request('/conflict')
    expect(res.status).toBe(409)

    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      type: 'https://api.abugida.com/errors/conflict',
      status: 409,
      detail: 'Duplicate resource.',
      instance: 'http://localhost/conflict',
    })
  })

  it('hides internal details on unhandled errors', async () => {
    const app = new Hono<AppEnv>()
    app.onError(errorHandler())
    app.get('/boom', () => {
      throw new Error('database-connection-string-leak')
    })

    const res = await app.request('/boom')
    expect(res.status).toBe(500)

    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      type: 'https://api.abugida.com/errors/internal-server-error',
      status: 500,
    })
    expect(String(body.detail)).not.toContain('database-connection-string-leak')
  })
})

describe('rateLimitMiddleware', () => {
  function makeApp(limiters: RateLimiters): Hono<AppEnv> {
    const app = new Hono<AppEnv>()
    app.use('/api/v1/*', rateLimitMiddleware(limiters))
    app.get('/api/v1/x', (c) => c.text('ok'))
    return app
  }

  function tinyLimiters(): RateLimiters {
    return {
      authenticated: createMemoryRateLimiter({ keyPrefix: 'test:auth', points: 2, duration: 60 }),
      anonymous: createMemoryRateLimiter({ keyPrefix: 'test:anon', points: 2, duration: 60 }),
    }
  }

  it('sets rate-limit headers and returns 429 past the quota', async () => {
    const app = makeApp(tinyLimiters())

    const first = await app.request('/api/v1/x')
    expect(first.status).toBe(200)
    expect(first.headers.get('X-RateLimit-Limit')).toBe('2')
    expect(first.headers.get('X-RateLimit-Remaining')).toBe('1')
    expect(first.headers.get('X-RateLimit-Reset')).toBeTruthy()

    const second = await app.request('/api/v1/x')
    expect(second.status).toBe(200)
    expect(second.headers.get('X-RateLimit-Remaining')).toBe('0')

    const third = await app.request('/api/v1/x')
    expect(third.status).toBe(429)
    expect(third.headers.get('Retry-After')).toBeTruthy()
    expect(third.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(third.headers.get('content-type')).toContain('application/problem+json')

    const body = (await third.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      type: 'https://api.abugida.com/errors/too-many-requests',
      status: 429,
    })
  })

  it('does not rate-limit routes outside the mounted prefix', async () => {
    const app = makeApp(tinyLimiters())

    for (let i = 0; i < 5; i += 1) {
      const res = await app.request('/other')
      expect(res.status).toBe(404)
    }
  })
})

describe('corsMiddleware', () => {
  function makeApp(): Hono<AppEnv> {
    const app = new Hono<AppEnv>()
    app.use('*', corsMiddleware())
    app.get('/x', (c) => c.text('ok'))
    return app
  }

  it('answers preflight without allowing a disallowed origin', async () => {
    const res = await makeApp().request('/x', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.example',
        'Access-Control-Request-Method': 'GET',
      },
    })

    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET')
    expect(res.headers.get('Vary')).toContain('Origin')
  })

  it('echoes a configured origin with credentials', async () => {
    if (appConfig.corsOrigins.length === 0) {
      return // no trusted origins configured in this environment
    }
    const origin = appConfig.corsOrigins[0]!

    const res = await makeApp().request('/x', { headers: { Origin: origin } })
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin)
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true')
  })
})
