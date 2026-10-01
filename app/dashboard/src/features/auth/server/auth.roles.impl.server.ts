/**
 * Server-only role resolution. Never import from client code — this module
 * pulls in the shared auth instance and the workspace resolver.
 *
 * The membership query and the role translation are the shared authorization
 * helpers in `@abugida/auth`, so "am I an admin?" is answered by the same code
 * here as in the API's own checks.
 */
import { getAuth } from '#/config/auth.server'
import type { PlatformRole } from '../auth.roles'

/**
 * Resolve the platform role for the calling user.
 *
 * Roles are **workspace-scoped** (spec 13), so this resolves the role of the
 * *active workspace* membership and falls back to the most privileged
 * membership when the session has no workspace. That keeps every route guard,
 * the navigation, and the command palette reading the same answer — a permission
 * gate can never disagree with the menu the user is looking at.
 *
 * Falls back to the least-privileged `viewer` when the user has no org
 * membership yet — role assignment is an admin concern, not a session error.
 */
export async function resolvePlatformRoleImpl(_userId: string | null): Promise<PlatformRole> {
  const { resolveActiveWorkspaceRoleImpl } =
    await import('#/features/workspaces/server/workspaces.impl.server')
  return resolveActiveWorkspaceRoleImpl()
}

/** Resolve the calling request's platform role. Runs inside handler context. */
export async function getServerRoleImpl(): Promise<PlatformRole> {
  const { getRequest } = await import('@tanstack/react-start/server')
  const request = getRequest()
  const session = await getAuth().getSession(request.headers)
  return resolvePlatformRoleImpl(session.ok ? session.value.user.id : null)
}
