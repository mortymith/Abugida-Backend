/**
 * @module middleware/tanstack/server
 *
 * Server-only TanStack Start integration. Import this from server functions,
 * loaders, and actions — never from client code or route modules. Route guards
 * should use the client-safe `@abugida/auth/tanstack/guard` entry point.
 *
 * Apps that must declare the server functions in their own source (see
 * `core/handlers.ts` for why) should call the `serverSession`,
 * `serverRefreshedSession`, `serverSignOut` and `serverAccessToken` helpers
 * directly instead.
 */

import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import type { AuthInstance } from '../../core/auth'
import {
  serverAccessToken,
  serverRefreshedSession,
  serverSession,
  serverSignOut,
} from '../../core/handlers'
import type { AuthServerFunctions } from './guards'

export type { AuthServerFunctions } from './guards'
export { requireAuthBeforeLoad } from './guards'

export {
  serverAccessToken,
  serverRefreshedSession,
  serverSession,
  serverSignOut,
} from '../../core/handlers'

// ---------------------------------------------------------------------------
// Server-side: server functions for SSR loaders / actions
// ---------------------------------------------------------------------------

export function createAuthServerFunctions(auth: AuthInstance): AuthServerFunctions {
  const getServerSession = createServerFn({ method: 'GET' }).handler(async () =>
    serverSession(auth, getRequest().headers),
  )

  const refreshServerSession = createServerFn({ method: 'GET' }).handler(async () =>
    serverRefreshedSession(auth, getRequest().headers),
  )

  const signOutServer = createServerFn({ method: 'POST' }).handler(async () =>
    serverSignOut(auth, getRequest().headers),
  )

  const getServerAccessToken = createServerFn({ method: 'GET' })
    .validator((input: { providerId: string }) => input)
    .handler(async ({ data }) => serverAccessToken(auth, getRequest().headers, data.providerId))

  return { getServerSession, refreshServerSession, signOutServer, getServerAccessToken }
}
