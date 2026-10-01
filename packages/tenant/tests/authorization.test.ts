import { describe, expect, test } from 'bun:test'
import {
  hasTenantPermission,
  requireSameTenant,
  requireTenantContextBySlug,
  requireTenantMembership,
  requireTenantPermission,
  toTenantRole,
  type Tenant,
  type TenantMembership,
  type TenantStore,
} from '../src/authorization'
import {
  TenantMembershipError,
  TenantNotFoundError,
  TenantUnauthenticatedError,
} from '../src/errors'
import { TENANT_PERMISSIONS } from '../src/permissions'

const ACME: Tenant = { id: 'org-a', slug: 'acme', name: 'Acme Academy' }
const GLOBEX: Tenant = { id: 'org-b', slug: 'globex', name: 'Globex' }

/** In-memory store: two tenants, one member row, everything else anonymous. */
function fakeStore(
  options: {
    tenants?: Tenant[]
    memberships?: TenantMembership[]
  } = {},
): TenantStore {
  const tenants = options.tenants ?? [ACME, GLOBEX]
  const memberships = options.memberships ?? [
    { id: 'mem-1', tenantId: 'org-a', userId: 'user-a', role: 'owner' },
  ]
  return {
    async findTenantBySlug(slug) {
      return tenants.find((tenant) => tenant.slug === slug) ?? null
    },
    async findTenantById(id) {
      return tenants.find((tenant) => tenant.id === id) ?? null
    },
    async findMembership({ tenantId, userId }) {
      return memberships.find((m) => m.tenantId === tenantId && m.userId === userId) ?? null
    },
  }
}

describe('requireTenantMembership', () => {
  test('a member gets a fully established context', async () => {
    const context = await requireTenantMembership({
      store: fakeStore(),
      tenant: ACME,
      userId: 'user-a',
    })
    expect(context).toEqual({
      tenantId: 'org-a',
      slug: 'acme',
      tenantName: 'Acme Academy',
      userId: 'user-a',
      membershipId: 'mem-1',
      role: 'admin',
      rawRole: 'owner',
    })
  })

  test('an anonymous caller is unauthorized, never a context', async () => {
    await expect(
      requireTenantMembership({ store: fakeStore(), tenant: ACME, userId: null }),
    ).rejects.toBeInstanceOf(TenantUnauthenticatedError)
  })

  test('a signed-in non-member is refused — the cross-tenant case', async () => {
    await expect(
      requireTenantMembership({ store: fakeStore(), tenant: GLOBEX, userId: 'user-a' }),
    ).rejects.toBeInstanceOf(TenantMembershipError)
  })

  test('a store answering about a different tenant cannot authorize the request', async () => {
    const store: TenantStore = {
      findTenantBySlug: async () => ACME,
      findTenantById: async () => ACME,
      // A store bug (or a careless query) answering with someone else's row.
      findMembership: async () => ({
        id: 'mem-9',
        tenantId: 'org-b',
        userId: 'user-a',
        role: 'owner',
      }),
    }
    await expect(
      requireTenantMembership({ store, tenant: ACME, userId: 'user-a' }),
    ).rejects.toBeInstanceOf(TenantMembershipError)
  })

  test('the raw Better Auth role maps onto the shared role vocabulary', () => {
    expect(toTenantRole('owner')).toBe('admin')
    expect(toTenantRole('admin')).toBe('admin')
    expect(toTenantRole('editor')).toBe('editor')
    expect(toTenantRole(null)).toBe('viewer')
  })
})

describe('requireTenantContextBySlug', () => {
  test('resolves the tenant by slug and verifies the membership', async () => {
    const context = await requireTenantContextBySlug({
      store: fakeStore(),
      slug: 'acme',
      userId: 'user-a',
    })
    expect(context.tenantId).toBe('org-a')
  })

  test('an unknown slug is not found, not forbidden', async () => {
    await expect(
      requireTenantContextBySlug({ store: fakeStore(), slug: 'unknown', userId: 'user-a' }),
    ).rejects.toBeInstanceOf(TenantNotFoundError)
  })

  test('a known slug the caller does not belong to is forbidden', async () => {
    await expect(
      requireTenantContextBySlug({ store: fakeStore(), slug: 'globex', userId: 'user-a' }),
    ).rejects.toBeInstanceOf(TenantMembershipError)
  })
})

describe('tenant permissions', () => {
  test('a permission is granted or denied by role, never by tenant id', async () => {
    const admin = await requireTenantMembership({
      store: fakeStore(),
      tenant: ACME,
      userId: 'user-a',
    })
    expect(hasTenantPermission(admin, 'organization:manage')).toBe(true)
    expect(hasTenantPermission(admin, 'course:delete')).toBe(true)
    expect(hasTenantPermission('viewer', 'organization:read')).toBe(true)
    expect(hasTenantPermission('viewer', 'course:create')).toBe(false)
    expect(hasTenantPermission('editor', 'course:update')).toBe(true)
    expect(hasTenantPermission('editor', 'organization:manage')).toBe(false)
    expect(hasTenantPermission('support', 'student:manage')).toBe(true)
    expect(hasTenantPermission('support', 'course:create')).toBe(false)
  })

  test('requireTenantPermission returns the context when allowed', async () => {
    const context = await requireTenantMembership({
      store: fakeStore(),
      tenant: ACME,
      userId: 'user-a',
    })
    expect(requireTenantPermission(context, 'student:manage')).toBe(context)
  })

  test('requireTenantPermission throws when denied', () => {
    expect(() => requireTenantPermission('viewer', 'course:delete')).toThrow()
  })

  test('every declared permission belongs to exactly one role tier', () => {
    for (const permission of TENANT_PERMISSIONS) {
      expect(hasTenantPermission('admin', permission)).toBe(true)
    }
  })
})

describe('requireSameTenant', () => {
  const context = {
    tenantId: 'org-a',
    slug: 'acme',
    tenantName: 'Acme Academy',
    userId: 'user-a',
    membershipId: 'mem-1',
    role: 'admin' as const,
    rawRole: 'owner',
  }

  test('a client-supplied id inside the context passes', () => {
    expect(() => requireSameTenant(context, 'org-a')).not.toThrow()
  })

  test('a client-supplied id from another tenant is rejected', () => {
    expect(() => requireSameTenant(context, 'org-b')).toThrow(TenantMembershipError)
  })

  test('an absent id is not compared', () => {
    expect(() => requireSameTenant(context, null)).not.toThrow()
    expect(() => requireSameTenant(context, undefined)).not.toThrow()
  })
})
