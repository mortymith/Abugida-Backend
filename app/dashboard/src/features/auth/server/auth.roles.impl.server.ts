/**
 * Server-only role resolution. Never import from client code — this module
 * pulls in the database client and the Better Auth server instance.
 */
import { eq } from '@abugida/database'
import { member } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import { auth } from '#/config/auth.server'
import { mapBetterAuthRoleToPlatformRole, ROLE_PRIORITY } from '../auth.roles'
import type { PlatformRole } from '../auth.roles'

/**
 * Resolve a user's platform role from the Better Auth organization `member`
 * table. Falls back to the least-privileged `viewer` when the user has no
 * org membership yet — role assignment is an admin concern, not a session
 * error.
 */
export async function resolvePlatformRoleImpl(userId: string): Promise<PlatformRole> {
  const rows = await db.select({ role: member.role }).from(member).where(eq(member.userId, userId))

  let best: PlatformRole = 'viewer'
  for (const row of rows) {
    const candidate = mapBetterAuthRoleToPlatformRole(row.role)
    if (ROLE_PRIORITY[candidate] > ROLE_PRIORITY[best]) best = candidate
  }
  return best
}

/** Resolve the calling request's platform role. Runs inside handler context. */
export async function getServerRoleImpl(): Promise<PlatformRole> {
  const { getRequest } = await import('@tanstack/react-start/server')
  const request = getRequest()
  const session = await auth.getSession(request.headers)
  if (!session.ok) return 'viewer'
  return resolvePlatformRoleImpl(session.value.user.id)
}
