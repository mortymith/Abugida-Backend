import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import type { Tenant, TenantMembership, TenantStore } from '../src/authorization'
import { requireTenantContextMiddleware, tenantHostMiddleware } from '../src/hono'

const ACME: Tenant = { id: 'org-a', slug: 'acme', name: 'Acme Academy' }
const GLOBEX: Tenant = { id: 'org-b', slug: 'globex', name: 'Globex' }

function fakeStore(): TenantStore {
  const tenants = [ACME, GLOBEX]
  const memberships: TenantMembership[] = [
    { id: 'mem-1', tenantId: 'org-a', userId: 'user-a', role: 'owner' },
  ]
  return {
    async findTenantBySlug(slug) {
      return tenants.find((t) => t.slug === slug) ?? null
    },
    async findTenantById(id) {
      return tenants.find((t) => t.id === id) ?? null
    },
    async findMembership({ tenantId, userId }) {
      return memberships.find((m) => m.tenantId === tenantId && m.userId === userId) ?? null
    },
  }
}

/** `userId: null` models an anonymous request (no session on the context). */
function app(userId: string | null) {
  const instance = new Hono<{ Variables: { user: { id: string } | null } }>()
  instance.use('*', async (c, next) => {
    c.set('user', userId ? { id: userId } : null)
    await next()
  })
  instance.use('*', tenantHostMiddleware({ baseDomain: 'abugida.com' }))
  instance.use('*', requireTenantContextMiddleware({ store: fakeStore() }))
  instance.get('/me', (c) => {
    const tenant = c.get('tenant')
    return c.json({ tenantId: tenant?.tenantId ?? null, slug: tenant?.slug ?? null })
  })
  return instance
}

describe('tenant middleware', () => {
  test('a member on a tenant host gets a context', async () => {
    const res = await app('user-a').request('/me', { headers: { host: 'acme.abugida.com' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ tenantId: 'org-a', slug: 'acme' })
  })

  test('a non-member on the same host is forbidden', async () => {
    const res = await app('user-a').request('/me', { headers: { host: 'globex.abugida.com' } })
    expect(res.status).toBe(403)
  })

  test('an unknown tenant host is not found', async () => {
    const res = await app('user-a').request('/me', { headers: { host: 'nope.abugida.com' } })
    expect(res.status).toBe(404)
  })

  test('an anonymous request to a tenant host is unauthorized', async () => {
    const res = await app(null).request('/me', { headers: { host: 'acme.abugida.com' } })
    expect(res.status).toBe(401)
  })

  test('a platform host is not a tenant and passes through with no context', async () => {
    for (const host of ['dashboard.abugida.com', 'api.abugida.com', 'abugida.com']) {
      const res = await app('user-a').request('/me', { headers: { host } })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ tenantId: null, slug: null })
    }
  })

  test('a development host with a port resolves and authorizes identically', async () => {
    const instance = new Hono<{ Variables: { user: { id: string } | null } }>()
    instance.use('*', async (c, next) => {
      c.set('user', { id: 'user-a' })
      await next()
    })
    instance.use('*', tenantHostMiddleware({ baseDomain: 'localhost' }))
    instance.use('*', requireTenantContextMiddleware({ store: fakeStore() }))
    instance.get('/me', (c) => c.json({ tenantId: c.get('tenant')?.tenantId ?? null }))

    const res = await instance.request('/me', { headers: { host: 'acme.localhost:3000' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ tenantId: 'org-a' })
  })
})
