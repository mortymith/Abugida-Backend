/**
 * @module auth.middleware.test
 * @description Unit tests for the auth middleware (optionalSessionMiddleware, requireAuthMiddleware).
 */

import { Hono } from 'hono'
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import type { AuthInstance } from '@abugida/auth'
import type { AppEnv } from '@/middleware/types'

const mockWithSession = mock(() => async (c: any, next: any) => {
  c.set('session', { id: 'sess-1' })
  c.set('user', { id: 'user-1', name: 'Test User' })
  return next()
})

const mockRequireSession = mock(() => async (c: any, next: any) => {
  const session = c.get('session')
  if (!session) {
    return c.json({ type: 'https://api.abugida.com/errors/unauthorized', status: 401 }, 401)
  }
  return next()
})

mock.module('@abugida/auth/hono', () => ({
  withSession: mockWithSession,
  requireSession: mockRequireSession,
}))

describe('optionalSessionMiddleware', () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  it('resolves session and populates context', async () => {
    const { optionalSessionMiddleware } = await import('@/middleware/auth.middleware')
    const app = new Hono<AppEnv>()
    const auth = {} as AuthInstance

    app.use('*', optionalSessionMiddleware(auth))
    app.get('/test', (c) => {
      const session = c.get('session')
      const user = c.get('user')
      return c.json({ session, user })
    })

    const res = await app.request('/test')
    expect(res.status).toBe(200)

    const body = (await res.json()) as any
    expect(body.session).toEqual({ id: 'sess-1' })
    expect(body.user).toEqual({ id: 'user-1', name: 'Test User' })
  })

  it('calls withSession with the auth instance', async () => {
    const { optionalSessionMiddleware } = await import('@/middleware/auth.middleware')
    const app = new Hono<AppEnv>()
    const auth = { secret: 'test' } as unknown as AuthInstance

    app.use('*', optionalSessionMiddleware(auth))
    app.get('/test', (c) => c.text('ok'))

    await app.request('/test')
    expect(mockWithSession).toHaveBeenCalledWith(auth)
  })
})

describe('requireAuthMiddleware', () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  it('rejects requests without session', async () => {
    const { requireAuthMiddleware } = await import('@/middleware/auth.middleware')
    const app = new Hono<AppEnv>()
    const auth = {} as AuthInstance

    mockRequireSession.mockImplementationOnce(() => async (c: any) => {
      return c.json({ type: 'https://api.abugida.com/errors/unauthorized', status: 401 }, 401)
    })

    app.use('/api/v1/*', requireAuthMiddleware(auth))
    app.get('/api/v1/courses', (c) => c.json({ ok: true }))

    const res = await app.request('/api/v1/courses')
    expect(res.status).toBe(401)
  })

  it('passes through with valid session', async () => {
    const { requireAuthMiddleware } = await import('@/middleware/auth.middleware')
    const app = new Hono<AppEnv>()
    const auth = {} as AuthInstance

    mockRequireSession.mockImplementationOnce(() => async (c: any, next: any) => {
      c.set('session', { id: 'sess-1' })
      c.set('user', { id: 'user-1' })
      return next()
    })

    app.use('/api/v1/*', requireAuthMiddleware(auth))
    app.get('/api/v1/courses', (c) => c.json({ ok: true }))

    const res = await app.request('/api/v1/courses')
    expect(res.status).toBe(200)
  })

  it('allows public paths to bypass auth', async () => {
    const { requireAuthMiddleware } = await import('@/middleware/auth.middleware')
    const app = new Hono<AppEnv>()
    const auth = {} as AuthInstance

    mockRequireSession.mockImplementationOnce(() => async (c: any) => {
      return c.json({ type: 'https://api.abugida.com/errors/unauthorized', status: 401 }, 401)
    })

    app.use('/api/v1/*', requireAuthMiddleware(auth))
    app.get('/api/v1/exam-types', (c) => c.json({ ok: true }))

    const res = await app.request('/api/v1/exam-types')
    // Public paths bypass auth — the requireSession guard is skipped
    expect(res.status).toBe(200)
  })
})
