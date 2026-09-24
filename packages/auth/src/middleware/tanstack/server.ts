/**
 * @module middleware/tanstack/server
 *
 * Server-only TanStack Start integration. Import this from server functions,
 * loaders, and actions — never from client code or route modules. Route guards
 * should use the client-safe `@abugida/auth/tanstack/guard` entry point.
 */

import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import type { AuthInstance } from '../../core/auth'
import type { AuthServerFunctions } from './guards'

export type { AuthServerFunctions } from './guards'
export { requireAuthBeforeLoad } from './guards'

// ---------------------------------------------------------------------------
// Server-side: server functions for SSR loaders / actions
// ---------------------------------------------------------------------------

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
