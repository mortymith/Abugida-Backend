/**
 * @module logging.middleware.test
 * @description Unit tests for the access-log middleware.
 */

import { Hono } from 'hono'
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import type { AppEnv } from '@/middleware/types'

const mockLogger = {
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
}

mock.module('@/config/observability', () => ({
  logger: mockLogger,
}))

describe('loggingMiddleware', () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  function makeApp(): Hono<AppEnv> {
    const app = new Hono<AppEnv>()
    return app
  }

  it('logs info for successful responses (2xx)', async () => {
    const { loggingMiddleware } = await import('@/middleware/logging.middleware')
    const app = makeApp()
    app.use('*', loggingMiddleware())
    app.get('/ok', (c) => c.text('ok'))

    const res = await app.request('/ok')
    expect(res.status).toBe(200)

    await new Promise((r) => setTimeout(r, 10))

    expect(mockLogger.info).toHaveBeenCalled()
    const callArgs = mockLogger.info.mock.calls[0] as any[]
    expect(callArgs[0]).toMatchObject({
      method: 'GET',
      status: 200,
    })
    expect(typeof callArgs[0].durationMs).toBe('number')
    expect(callArgs[1]).toBe('request completed')
  })

  it('logs warn for client errors (4xx)', async () => {
    const { loggingMiddleware } = await import('@/middleware/logging.middleware')
    const app = makeApp()
    app.use('*', loggingMiddleware())
    app.get('/not-found', (c) => c.notFound())

    const res = await app.request('/not-found')
    expect(res.status).toBe(404)

    await new Promise((r) => setTimeout(r, 10))

    expect(mockLogger.warn).toHaveBeenCalled()
    const callArgs = mockLogger.warn.mock.calls[0] as any[]
    expect(callArgs[0]).toMatchObject({
      method: 'GET',
      status: 404,
    })
    expect(callArgs[1]).toBe('request rejected')
  })

  it('logs error for server errors (5xx)', async () => {
    const { loggingMiddleware } = await import('@/middleware/logging.middleware')
    const app = makeApp()
    app.use('*', loggingMiddleware())
    app.onError((_err, c) => c.text('error', 500))
    app.get('/error', () => {
      throw new Error('test error')
    })

    const res = await app.request('/error')
    expect(res.status).toBe(500)

    await new Promise((r) => setTimeout(r, 10))

    expect(mockLogger.error).toHaveBeenCalled()
    const callArgs = mockLogger.error.mock.calls[0] as any[]
    expect(callArgs[0]).toMatchObject({
      method: 'GET',
      status: 500,
    })
    expect(callArgs[1]).toBe('request failed')
  })

  it('includes requestId in log fields', async () => {
    const { loggingMiddleware } = await import('@/middleware/logging.middleware')
    const { requestIdMiddleware } = await import('@/middleware/request-id.middleware')
    const app = makeApp()
    app.use('*', requestIdMiddleware())
    app.use('*', loggingMiddleware())
    app.get('/test', (c) => c.text('ok'))

    const res = await app.request('/test')
    expect(res.status).toBe(200)

    await new Promise((r) => setTimeout(r, 10))

    expect(mockLogger.info).toHaveBeenCalled()
    const callArgs = mockLogger.info.mock.calls[0] as any[]
    expect(callArgs[0].requestId).toBeDefined()
    expect(typeof callArgs[0].requestId).toBe('string')
  })

  it('includes userId when user is set in context', async () => {
    const { loggingMiddleware } = await import('@/middleware/logging.middleware')
    const app = makeApp()
    app.use('*', async (c, next) => {
      c.set('user', { id: 'user-123' })
      return next()
    })
    app.use('*', loggingMiddleware())
    app.get('/test', (c) => c.text('ok'))

    const res = await app.request('/test')
    expect(res.status).toBe(200)

    await new Promise((r) => setTimeout(r, 10))

    expect(mockLogger.info).toHaveBeenCalled()
    const callArgs = mockLogger.info.mock.calls[0] as any[]
    expect(callArgs[0].userId).toBe('user-123')
  })

  it('omits userId when user is not set', async () => {
    const { loggingMiddleware } = await import('@/middleware/logging.middleware')
    const app = makeApp()
    app.use('*', loggingMiddleware())
    app.get('/test', (c) => c.text('ok'))

    const res = await app.request('/test')
    expect(res.status).toBe(200)

    await new Promise((r) => setTimeout(r, 10))

    expect(mockLogger.info).toHaveBeenCalled()
    const callArgs = mockLogger.info.mock.calls[0] as any[]
    expect(callArgs[0].userId).toBeUndefined()
  })

  it('rounds durationMs to 2 decimal places', async () => {
    const { loggingMiddleware } = await import('@/middleware/logging.middleware')
    const app = makeApp()
    app.use('*', loggingMiddleware())
    app.get('/test', (c) => c.text('ok'))

    await app.request('/test')
    await new Promise((r) => setTimeout(r, 10))

    const callArgs = mockLogger.info.mock.calls[0] as any[]
    const duration = callArgs[0].durationMs
    expect(typeof duration).toBe('number')
    expect(duration.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2)
  })
})
