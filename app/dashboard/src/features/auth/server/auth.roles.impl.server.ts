/**
 * Server-only role resolution. Never import from client code — this module
 * pulls in the database client and the shared auth instance.
 *
 * The membership query and the role translation are the shared authorization
 * helpers in `@abugida/auth`, so "am I an admin?" is answered by the same code
 * here as in the API's own checks.
 */
import { resolveUserPlatformRole } from '@abugida/auth'
import { db } from '#/config/db.config'
import { getAuth } from '#/config/auth.server'
import type { PlatformRole } from '../auth.roles'

/**
 * Resolve a user's platform role across their organizations. Falls back to the
 * least-privileged `viewer` when the user has no org membership yet — role
 * assignment is an admin concern, not a session error.
 */
export async function resolvePlatformRoleImpl(userId: string | null): Promise<PlatformRole> {
  return resolveUserPlatformRole(db, userId)
}

/** Resolve the calling request's platform role. Runs inside handler context. */
export async function getServerRoleImpl(): Promise<PlatformRole> {
  const { getRequest } = await import('@tanstack/react-start/server')
  const request = getRequest()
  const session = await getAuth().getSession(request.headers)
  return resolvePlatformRoleImpl(session.ok ? session.value.user.id : null)
}
