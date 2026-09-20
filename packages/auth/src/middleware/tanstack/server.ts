/**
 * @module middleware/tanstack/server
 *
 * Server-only TanStack Start integration. Import this from server functions,
 * loaders, actions, and beforeLoad guards — never from client components.
 */

import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { redirect } from '@tanstack/react-router'
import type { AuthInstance } from '../../core/auth'
import type { ResolvedSession } from '../../core/session'

// ---------------------------------------------------------------------------
// Server-side: server functions for SSR loaders / actions
// ---------------------------------------------------------------------------

export interface AuthServerFunctions {
  /** Call from a route `loader` to get the current session during SSR. */
  getServerSession: () => Promise<ResolvedSession | null>
  /** Like getServerSession, but bypasses better-auth's short cookie cache. */
  refreshServerSession: () => Promise<ResolvedSession | null>
  /** Call from an action/server function to sign the current user out. */
  signOutServer: () => Promise<{ success: true }>
  /**
   * Returns a valid (auto-refreshed) provider access token for the current
   * user, or null. Called as `getServerAccessToken({ data: { providerId } })`
   * per TanStack Start's server-function calling convention.
   */
  getServerAccessToken: (input: { data: { providerId: string } }) => Promise<string | null>
}

export function createAuthServerFunctions(auth: AuthInstance): AuthServerFunctions {
  const getServerSession = createServerFn({ method: 'GET' }).handler(async () => {
    const request = getRequest()
    const result = await auth.getSession(request.headers)
    return result.ok ? result.value : null
  })

  const refreshServerSession = createServerFn({ method: 'GET' }).handler(async () => {
    const request = getRequest()
    const result = await auth.refreshSession(request.headers)
    return result.ok ? result.value : null
  })

  const signOutServer = createServerFn({ method: 'POST' }).handler(async () => {
    const request = getRequest()
    await auth.signOut(request.headers)
    return { success: true as const }
  })

  const getServerAccessToken = createServerFn({ method: 'GET' })
    .validator((input: { providerId: string }) => input)
    .handler(async ({ data }) => {
      const request = getRequest()
      const session = await auth.getSession(request.headers)
      if (!session.ok) return null

      const token = await auth.getAccessToken({
        userId: session.value.user.id,
        providerId: data.providerId,
      })
      return token.ok ? token.value.accessToken : null
    })

  return { getServerSession, refreshServerSession, signOutServer, getServerAccessToken }
}

// ---------------------------------------------------------------------------
// Route guards
// ---------------------------------------------------------------------------

interface RequireAuthOptions {
  /** Where to send unauthenticated users. Default "/login". */
  loginPath?: string
}

/**
 * Drop into a route's `beforeLoad`:
 * ```ts
 * export const Route = createFileRoute("/dashboard")({
 *   beforeLoad: requireAuthBeforeLoad(authServerFns, { loginPath: "/sign-in" }),
 * });
 * ```
 */
export function requireAuthBeforeLoad(
  serverFns: AuthServerFunctions,
  options: RequireAuthOptions = {},
) {
  return async ({ location }: { location: { href: string } }) => {
    const session = await serverFns.getServerSession()
    if (!session) {
      throw redirect({
        to: options.loginPath ?? '/login',
        search: { redirectTo: location.href },
      })
    }
    return { session }
  }
}
