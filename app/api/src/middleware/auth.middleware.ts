/**
 * @module auth
 *
 * Authentication middleware for the API. All session resolution lives in the
 * shared `@abugida/auth` package (Better Auth) — this module only composes it:
 *
 *   - `optionalSessionMiddleware()` — resolves the session for feature
 *     requests without rejecting anonymous callers. Populates
 *     `c.get("session")` / `c.get("user")` so the rate limiter can pick the
 *     authenticated quota and handlers can branch on login state.
 *   - `requireAuthMiddleware()` — rejects requests without a valid session
 *     (401 problem+json), skipping the documented public endpoints.
 *
 * The API is mounted at the root (no `/api/v1` prefix) and every handler that
 * needs an identity additionally self-guards; this middleware is the
 * defense-in-depth layer.
 */

import type { MiddlewareHandler } from 'hono'
import { requireSession, withSession } from '@abugida/auth/hono'
import type { AuthInstance } from '@abugida/auth'
import type { AppEnv } from './types'

/**
 * Public catalog roots — anonymous GETs are allowed by the API spec (they are
 * cacheable read endpoints). Mutations under these roots still require auth.
 */
const PUBLIC_GET_ROOTS: ReadonlySet<string> = new Set([
  '/courses',
  '/exam-types',
  '/tags',
  '/bundles',
  '/modules',
  '/lessons',
  '/resources',
  '/quiz',
  '/search',
])

/** Root prefixes that always stay public regardless of method. */
const PUBLIC_ROOTS: ReadonlySet<string> = new Set(['/auth', '/health'])

const PUBLIC_DOC_PREFIXES: ReadonlySet<string> = new Set(['/doc', '/openapi'])

/**
 * Decides whether a request is allowed through without a session. Uses the
 * resolved request path (`c.req.path`) and method.
 */
function isPublicRequest(c: Parameters<MiddlewareHandler<AppEnv>>[0]): boolean {
  const path = c.req.path
  if (PUBLIC_ROOTS.has(path) || PUBLIC_ROOTS.has(path.split('/').slice(0, 2).join('/'))) {
    return true
  }
  if (
    PUBLIC_DOC_PREFIXES.has(path) ||
    [...PUBLIC_DOC_PREFIXES].some((p) => path.startsWith(p + '/'))
  ) {
    return true
  }
  const topLevel = path.split('/')[1] ? `/${path.split('/')[1]}` : '/'
  if (c.req.method === 'GET' && PUBLIC_GET_ROOTS.has(topLevel)) {
    return true
  }
  return false
}

/** Resolve the session for a request without rejecting unauthenticated callers. */
export function optionalSessionMiddleware(auth: AuthInstance): MiddlewareHandler<AppEnv> {
  return withSession(auth) as unknown as MiddlewareHandler<AppEnv>
}

/** Require a valid session, honoring the public-path allowlist. */
export function requireAuthMiddleware(auth: AuthInstance): MiddlewareHandler<AppEnv> {
  const guard = requireSession(auth) as unknown as MiddlewareHandler<AppEnv>

  return async (c, next) => {
    if (isPublicRequest(c)) {
      return next()
    }
    return guard(c, next)
  }
}
