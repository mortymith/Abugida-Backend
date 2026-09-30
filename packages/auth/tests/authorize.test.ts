import { describe, expect, it } from 'bun:test'
import {
  activeOrganizationId,
  requireOrganizationRole,
  resolveOrganizationAccess,
  resolveUserPlatformRole,
} from '../src/core/authorize'
import {
  ROLE_PRIORITY,
  hasAtLeastRole,
  highestPlatformRole,
  isPlatformRole,
  mapBetterAuthRoleToPlatformRole,
} from '../src/core/roles'
import type { ResolvedSession } from '../src/core/session'

/** Minimal Drizzle stand-in: `select().from().where()` resolves to `rows`. */
function fakeDb(rows: Array<{ organizationId: string; role: string }>): unknown {
  return {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(rows),
      }),
    }),
  }
}

function session(
  userId = 'user-1',
  activeOrganizationId: string | null = 'org-1',
): ResolvedSession {
  return {
    session: {
      id: 'session-1',
      userId,
      expiresAt: new Date(Date.now() + 60_000),
      activeOrganizationId,
    },
    user: {
      id: userId,
      email: `${userId}@abugida.app`,
      name: null,
      emailVerified: true,
      image: null,
    },
  }
}

describe('role vocabulary', () => {
  it('maps better-auth owner/admin onto the admin platform role', () => {
    expect(mapBetterAuthRoleToPlatformRole('owner')).toBe('admin')
    expect(mapBetterAuthRoleToPlatformRole('admin')).toBe('admin')
  })

  it('keeps the custom roles verbatim and falls back to viewer', () => {
    expect(mapBetterAuthRoleToPlatformRole('reviewer')).toBe('reviewer')
    expect(mapBetterAuthRoleToPlatformRole('nonsense')).toBe('viewer')
    expect(mapBetterAuthRoleToPlatformRole(null)).toBe('viewer')
  })

  it('takes the most privileged role from a comma-separated list', () => {
    expect(mapBetterAuthRoleToPlatformRole('member, editor')).toBe('editor')
    expect(highestPlatformRole(['viewer', 'support', 'editor'])).toBe('editor')
  })

  it('orders privileges so admin outranks everything', () => {
    expect(ROLE_PRIORITY.admin).toBeGreaterThan(ROLE_PRIORITY.editor)
    expect(hasAtLeastRole('editor', 'viewer')).toBe(true)
    expect(hasAtLeastRole('viewer', 'editor')).toBe(false)
    expect(isPlatformRole('admin')).toBe(true)
    expect(isPlatformRole('superuser')).toBe(false)
  })
})

describe('organization authorization', () => {
  const memberships = [
    { organizationId: 'org-1', role: 'owner' },
    { organizationId: 'org-2', role: 'viewer' },
  ]

  it('reads the active organization off the session', () => {
    expect(activeOrganizationId(session())).toBe('org-1')
    expect(activeOrganizationId(null)).toBeNull()
  })

  it('grants access to the active organization with the translated role', async () => {
    const result = await resolveOrganizationAccess(fakeDb(memberships), session())

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({
      organizationId: 'org-1',
      role: 'owner',
      platformRole: 'admin',
      active: true,
    })
  })

  it('authorizes a second organization the user also belongs to', async () => {
    const result = await resolveOrganizationAccess(fakeDb(memberships), session(), {
      organizationId: 'org-2',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.platformRole).toBe('viewer')
    expect(result.value.active).toBe(false)
  })

  it('refuses an organization the user is not a member of', async () => {
    const result = await resolveOrganizationAccess(fakeDb(memberships), session(), {
      organizationId: 'org-other',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('forbidden')
  })

  it('refuses when there is no session', async () => {
    const result = await resolveOrganizationAccess(fakeDb(memberships), null, {
      organizationId: 'org-1',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('unauthorized')
  })

  it('refuses when no organization is targeted and none is active', async () => {
    const result = await resolveOrganizationAccess(fakeDb(memberships), session('user-1', null))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('forbidden')
  })

  it('enforces a minimum role on top of membership', async () => {
    const denied = await requireOrganizationRole(fakeDb(memberships), session(), {
      organizationId: 'org-2',
      minimumRole: 'admin',
    })
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.error.kind).toBe('forbidden')

    const allowed = await requireOrganizationRole(fakeDb(memberships), session(), {
      organizationId: 'org-1',
      minimumRole: 'editor',
    })
    expect(allowed.ok).toBe(true)
  })

  it('resolves the strongest role a user holds across organizations', async () => {
    expect(await resolveUserPlatformRole(fakeDb(memberships), 'user-1')).toBe('admin')
    expect(await resolveUserPlatformRole(fakeDb(memberships), null)).toBe('viewer')
    expect(
      await resolveUserPlatformRole(
        fakeDb([{ organizationId: 'org-2', role: 'support' }]),
        'user-1',
      ),
    ).toBe('support')
  })
})
