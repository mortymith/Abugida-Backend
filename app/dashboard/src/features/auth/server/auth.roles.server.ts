import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import { mapBetterAuthRoleToPlatformRole, ROLE_PRIORITY } from '../auth.roles'
import type { PlatformRole } from '../auth.roles'

/**
 * Resolve the signed-in user's platform role from the Better Auth
 * organization `member` table (see @abugida/database auth schema).
 *
 * Falls back to the least-privileged `viewer` when the user has no org
 * membership yet — role assignment is an admin concern, not a session error.
 *
 * NOTE: db access is lazily imported inside the handler, matching the
 * repo-wide server-function convention (see config/auth.config.ts).
 */
export async function resolvePlatformRole(userId: string): Promise<PlatformRole> {
  const [{ db }, { member }, { eq }] = await Promise.all([
    import('#/config/db.config'),
    import('@abugida/database/auth'),
    import('@abugida/database'),
  ])

  const rows = await db.select({ role: member.role }).from(member).where(eq(member.userId, userId))

  let best: PlatformRole = 'viewer'
  for (const row of rows) {
    const candidate = mapBetterAuthRoleToPlatformRole(row.role)
    if (ROLE_PRIORITY[candidate] > ROLE_PRIORITY[best]) best = candidate
  }
  return best
}

export const getServerRole = createServerFn({ method: 'GET' }).handler(async () => {
  const { getRequest } = await import('@tanstack/react-start/server')
  const { auth } = await import('#/config/auth.server')

  const request = getRequest()
  const session = await auth.getSession(request.headers)
  if (!session.ok) return 'viewer'

  return resolvePlatformRole(session.value.user.id)
})

/**
 * Route-level hard gate. Use inside `beforeLoad` after authentication —
 * hiding UI affordances is the visible part of the spec 11 permission-aware
 * contract, but this guard is the actual security boundary.
 */
export async function requireRolesBeforeLoad(
  allowed: readonly PlatformRole[],
  options: { redirectTo?: string } = {},
): Promise<PlatformRole> {
  const role = await getServerRole()
  if (!allowed.includes(role)) {
    throw redirect({ to: options.redirectTo ?? '/dashboard' })
  }
  return role
}
