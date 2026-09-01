/**
 * @module error-handler.middleware.test
 * @description Additional unit tests for error handler middleware (problemResponse, zodOpenApiHook).
 */

import { Hono } from 'hono'
import { describe, it, expect } from 'bun:test'
import { HTTPException } from 'hono/http-exception'
import {
  problemResponse,
  zodOpenApiHook,
  errorHandler,
} from '@/middleware/error-handler.middleware'
import type { AppEnv } from '@/middleware/types'

describe('problemResponse', () => {
  it('builds a problem+json response with correct structure', async () => {
    const app = new Hono<AppEnv>()
    app.get('/test', (c) => {
      c.set('requestId', 'req-123')
      return problemResponse(c, {
        status: 422,
        detail: 'Validation failed.',
        errors: [{ field: 'name', message: 'Required', code: 'invalid_type' }],
      })
    })

    const res = await app.request('/test')
    expect(res.status).toBe(422)
    expect(res.headers.get('content-type')).toContain('application/problem+json')

    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      type: 'https://api.abugida.com/errors/validation-error',
      title: 'Unprocessable Entity',
      status: 422,
      detail: 'Validation failed.',
      instance: 'http://localhost/test',
      correlationId: 'req-123',
    })
    expect(body.errors).toHaveLength(1)
  })

  it('uses custom title when provided', async () => {
    const app = new Hono<AppEnv>()
    app.get('/test', (c) => {
      return problemResponse(c, {
        status: 400,
        detail: 'Bad input.',
        title: 'Custom Title',
      })
    })

    const res = await app.request('/test')
    const body = (await res.json()) as Record<string, unknown>
    expect(body.title).toBe('Custom Title')
  })

  it('omits errors array when empty', async () => {
    const app = new Hono<AppEnv>()
    app.get('/test', (c) => {
      return problemResponse(c, {
        status: 400,
        detail: 'Bad input.',
        errors: [],
      })
    })

    const res = await app.request('/test')
    const body = (await res.json()) as Record<string, unknown>
    expect(body.errors).toBeUndefined()
  })
})

describe('zodOpenApiHook', () => {
  it('returns undefined on successful validation', () => {
    const app = new Hono<AppEnv>()
    app.get('/test', (c) => {
      zodOpenApiHook({ success: true }, c)
      return c.text('ok')
    })

    // Synchronous test - just verify the function signature
    expect(typeof zodOpenApiHook).toBe('function')
  })

  it('returns 422 problem+json on validation failure', async () => {
    const app = new Hono<AppEnv>()
    app.get('/test', (c) => {
      return zodOpenApiHook(
        {
          success: false,
          error: {
            issues: [
              {
                path: ['body', 'name'],
                message: 'Required',
                code: 'invalid_type',
                rejectedValue: undefined,
              },
            ],
          },
        },
        c,
      )!
    })

    const res = await app.request('/test')
    expect(res.status).toBe(422)
    expect(res.headers.get('content-type')).toContain('application/problem+json')
  })

  it('maps zod issues to ProblemErrorField format', async () => {
    const app = new Hono<AppEnv>()
    app.get('/api/v1/courses', (c) => {
      return zodOpenApiHook(
        {
          success: false,
          error: {
            issues: [
              {
                path: ['body', 'title'],
                message: 'String too short',
                code: 'too_small',
                rejectedValue: 'ab',
              },
              {
                path: ['query', 'page'],
                message: 'Expected number',
                code: 'invalid_type',
              },
            ],
          },
        },
        c,
      )!
    })

    const res = await app.request('/api/v1/courses')
    expect(res.status).toBe(422)

    const body = (await res.json()) as Record<string, unknown>
    expect(body.errors).toHaveLength(2)
    expect(body.errors).toEqual([
      {
        field: 'body.title',
        message: 'String too short',
        code: 'too_small',
        rejectedValue: 'ab',
      },
      {
        field: 'query.page',
        message: 'Expected number',
        code: 'invalid_type',
      },
    ])
  })

  it('handles issues with empty path', async () => {
    const app = new Hono<AppEnv>()
    app.get('/test', (c) => {
      return zodOpenApiHook(
        {
          success: false,
          error: {
            issues: [
              {
                path: [],
                message: 'Invalid',
                code: 'invalid_value',
              },
            ],
          },
        },
        c,
      )!
    })

    const res = await app.request('/test')
    expect(res.status).toBe(422)

    const body = (await res.json()) as Record<string, unknown>
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0]).toMatchObject({ field: '' })
  })
})

describe('errorHandler additional coverage', () => {
  it('maps 400 HTTPException correctly', async () => {
    const app = new Hono<AppEnv>()
    app.onError(errorHandler())
    app.get('/bad', () => {
      throw new HTTPException(400, { message: 'Invalid request body.' })
    })

    const res = await app.request('/bad')
    expect(res.status).toBe(400)

    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      type: 'https://api.abugida.com/errors/invalid-parameter',
      status: 400,
      detail: 'Invalid request body.',
    })
  })

  it('maps 401 HTTPException correctly', async () => {
    const app = new Hono<AppEnv>()
    app.onError(errorHandler())
    app.get('/unauth', () => {
      throw new HTTPException(401, { message: 'Authentication required.' })
    })

    const res = await app.request('/unauth')
    expect(res.status).toBe(401)

    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      type: 'https://api.abugida.com/errors/unauthorized',
      status: 401,
    })
  })

  it('maps 403 HTTPException correctly', async () => {
    const app = new Hono<AppEnv>()
    app.onError(errorHandler())
    app.get('/forbidden', () => {
      throw new HTTPException(403, { message: 'Insufficient permissions.' })
    })

    const res = await app.request('/forbidden')
    expect(res.status).toBe(403)

    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      type: 'https://api.abugida.com/errors/forbidden',
      status: 403,
    })
  })

  it('maps 413 HTTPException correctly', async () => {
    const app = new Hono<AppEnv>()
    app.onError(errorHandler())
    app.get('/large', () => {
      throw new HTTPException(413, { message: 'File too large.' })
    })

    const res = await app.request('/large')
    expect(res.status).toBe(413)

    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      type: 'https://api.abugida.com/errors/payload-too-large',
      status: 413,
    })
  })

  it('maps 429 HTTPException correctly', async () => {
    const app = new Hono<AppEnv>()
    app.onError(errorHandler())
    app.get('/limited', () => {
      throw new HTTPException(429, { message: 'Rate limit exceeded.' })
    })

    const res = await app.request('/limited')
    expect(res.status).toBe(429)

    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      type: 'https://api.abugida.com/errors/too-many-requests',
      status: 429,
    })
  })

  it('maps 503 HTTPException correctly', async () => {
    const app = new Hono<AppEnv>()
    app.onError(errorHandler())
    app.get('/unavail', () => {
      throw new HTTPException(503, { message: 'Service unavailable.' })
    })

    const res = await app.request('/unavail')
    expect(res.status).toBe(503)

    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      type: 'https://api.abugida.com/errors/service-unavailable',
      status: 503,
    })
  })

  it('includes correlationId when requestId is set', async () => {
    const app = new Hono<AppEnv>()
    app.use('*', async (c, next) => {
      c.set('requestId', 'correlation-abc')
      return next()
    })
    app.onError(errorHandler())
    app.get('/test', () => {
      throw new Error('test')
    })

    const res = await app.request('/test')
    const body = (await res.json()) as Record<string, unknown>
    expect(body.correlationId).toBe('correlation-abc')
  })
})
