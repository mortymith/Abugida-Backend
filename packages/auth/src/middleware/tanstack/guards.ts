/**
 * @module middleware/tanstack/guards
 *
 * Client-safe TanStack Start route guards. This module has no server-only
 * dependencies, so it is safe to import from route files where `beforeLoad`
 * also runs in the browser during client navigation.
 *
 * Never import `@tanstack/react-start/server` from this module. That subpath
 * pulls in `node:stream` through TanStack Router's SSR entry points, which Vite
 * externalizes for browser compatibility.
 */

import { redirect } from '@tanstack/react-router'
import type { ResolvedSession } from '../../core/session'

export interface AuthServerFunctions {
  /** Call from a route `loader` to get the current session during SSR. */
  getServerSession: () => Promise<ResolvedSession | null>
  /** Like getServerSession, but bypasses better-auth's short cookie cache. */
  refreshServerSession: () => Promise<ResolvedSession | null>
  /** Call from an action/server function to sign the current user out. */
  signOutServer: () => Promise<{ success: true }>
  /**
   * Returns a valid, auto-refreshed provider access token for the current
   * user, or null. Called as `getServerAccessToken({ data: { providerId } })`
   * per TanStack Start's server-function calling convention.
   */
  getServerAccessToken: (input: { data: { providerId: string } }) => Promise<string | null>
}

export interface RequireAuthOptions {
  /** Where to send unauthenticated users. Default `/login`. */
  loginPath?: string
}

/**
 * Creates a route guard that redirects users without a server session.
 *
 * Import this from `@abugida/auth/tanstack/guard` in route modules. The
 * `serverFns` object may be loaded dynamically so its server implementation is
 * not included in the browser module graph.
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
