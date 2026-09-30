/**
 * Dashboard-side auth server functions.
 *
 * TanStack Start applies its server-function transform to this app's source,
 * not to a workspace package's `dist/`, and its import protection forbids a
 * route-reachable module from importing `*.server.*` modules — where the auth
 * instance lives. So these four RPC declarations must be declared *here*.
 *
 * What they do is not duplicated: every handler delegates to the shared
 * behaviour in `@abugida/auth` (`serverSession` and friends), which is the same
 * code `createAuthServerFunctions()` binds for apps that can import it
 * directly. This file cannot drift in behaviour, only in plumbing.
 */
import { createServerFn } from '@tanstack/react-start'
import {
  serverAccessToken,
  serverRefreshedSession,
  serverSession,
  serverSignOut,
} from '@abugida/auth'
// Type-only, so nothing framework-specific reaches the browser bundle.
import type { AuthServerFunctions } from '@abugida/auth/tanstack/server'

export const getServerSession = createServerFn({ method: 'GET' }).handler(async () => {
  const { getRequest } = await import('@tanstack/react-start/server')
  const { getAuth } = await import('./auth.server')
  return serverSession(getAuth(), getRequest().headers)
})

export const refreshServerSession = createServerFn({ method: 'GET' }).handler(async () => {
  const { getRequest } = await import('@tanstack/react-start/server')
  const { getAuth } = await import('./auth.server')
  return serverRefreshedSession(getAuth(), getRequest().headers)
})

export const signOutServer = createServerFn({ method: 'POST' }).handler(async () => {
  const { getRequest } = await import('@tanstack/react-start/server')
  const { getAuth } = await import('./auth.server')
  return serverSignOut(getAuth(), getRequest().headers)
})

export const getServerAccessToken = createServerFn({ method: 'GET' })
  .validator((input: { providerId: string }) => input)
  .handler(async ({ data }) => {
    const { getRequest } = await import('@tanstack/react-start/server')
    const { getAuth } = await import('./auth.server')
    return serverAccessToken(getAuth(), getRequest().headers, data.providerId)
  })

export const authServerFns: AuthServerFunctions = {
  getServerSession,
  refreshServerSession,
  signOutServer,
  getServerAccessToken,
}
