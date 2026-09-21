import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import type { PlatformRole } from '../auth.roles'

/**
 * Server-function wrappers for role resolution. The heavy lifting lives in
 * `auth.roles.impl.server.ts` (server-only, dynamically imported inside
 * handlers so this module stays safe for the client bundle).
 */
export const getServerRole = createServerFn({ method: 'GET' }).handler(async () => {
  const { getServerRoleImpl } = await import('./auth.roles.impl.server')
  return getServerRoleImpl()
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
