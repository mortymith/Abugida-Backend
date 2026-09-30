/**
 * @module core/handlers
 *
 * The behaviour behind the TanStack Start auth server functions, in a form an
 * app can wire to `createServerFn()` in its own source tree.
 *
 * Why this exists: TanStack Start's server-function transform is applied to
 * the app's source, not to a workspace package's `dist/`, and its
 * import-protection plugin forbids a route-reachable module from importing an
 * app's `*.server.*` module (where the auth instance lives). So an app must
 * *declare* the four server functions itself. What it must not do is
 * re-implement them — the result mapping, the token lookup and the failure
 * semantics live here, once.
 *
 * `middleware/tanstack/server.ts` binds these to `createServerFn()` for apps
 * that can import it directly; apps that hit the constraint above call them
 * from their own declarations.
 */

import type { AuthInstance } from './auth'
import type { ResolvedSession } from './session'

/** Current session, or `null` when signed out (including a failed session). */
export async function serverSession(
  auth: AuthInstance,
  headers: Headers,
): Promise<ResolvedSession | null> {
  const result = await auth.getSession(headers)
  return result.ok ? result.value : null
}

/** Same as {@link serverSession}, bypassing the short cookie cache. */
export async function serverRefreshedSession(
  auth: AuthInstance,
  headers: Headers,
): Promise<ResolvedSession | null> {
  const result = await auth.refreshSession(headers)
  return result.ok ? result.value : null
}

/** Revoke the current session. Idempotent from the caller's perspective. */
export async function serverSignOut(
  auth: AuthInstance,
  headers: Headers,
): Promise<{ success: true }> {
  await auth.signOut(headers)
  return { success: true }
}

/**
 * A valid, auto-refreshed provider access token for the caller, or `null` when
 * there is no session or no usable token.
 */
export async function serverAccessToken(
  auth: AuthInstance,
  headers: Headers,
  providerId: string,
): Promise<string | null> {
  const session = await auth.getSession(headers)
  if (!session.ok) return null

  const token = await auth.getAccessToken({
    userId: session.value.user.id,
    providerId,
  })
  return token.ok ? token.value.accessToken : null
}
