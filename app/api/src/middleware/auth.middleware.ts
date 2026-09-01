/**
 * @module auth
 *
 * Authentication middleware for the API. All session resolution lives in the
 * shared `@abugida/auth` package (Better Auth) — this module only composes it:
 *
 *   - `optionalSessionMiddleware()` — resolves the session for every
 *     `/api/v1/*` request without rejecting anonymous callers. Populates
 *     `c.get("session")` / `c.get("user")` so the rate limiter can pick the
 *     authenticated quota and handlers can branch on login state.
 *   - `requireAuthMiddleware()` — rejects requests without a valid session
 *     (401 problem+json), skipping the documented public catalog GETs.
 *
 * Bearer tokens and session cookies are both handled by Better Auth's
 * `getSession`; no custom JWT verification happens here.
 */

import type { MiddlewareHandler } from 'hono'
import { requireSession, withSession } from '@abugida/auth/hono'
import type { AuthInstance } from '@abugida/auth'
import type { AppEnv } from './types'

/**
 * Endpoints the spec treats as public (bearer not required) despite the global
 * `bearerAuth` default — the catalog read endpoints with public caching.
 *
 * Keys use the resolved request path (`c.req.path`), not the route pattern
 * (`c.req.routePath`), because `routePath` returns the glob pattern (e.g.
 * `/api/v1/*`) rather than the concrete path.
 */
const PUBLIC_PATHS: ReadonlySet<string> = new Set(['/api/v1/exam-types', '/api/v1/search/courses'])

/** Resolve the session for a request without rejecting unauthenticated callers. */
export function optionalSessionMiddleware(auth: AuthInstance): MiddlewareHandler<AppEnv> {
  return withSession(auth) as unknown as MiddlewareHandler<AppEnv>
}

/** Require a valid session, honoring the public-path allowlist. */
export function requireAuthMiddleware(auth: AuthInstance): MiddlewareHandler<AppEnv> {
  const guard = requireSession(auth) as unknown as MiddlewareHandler<AppEnv>

  return async (c, next) => {
    const path = c.req.path
    if (PUBLIC_PATHS.has(path)) {
      return next()
    }
    return guard(c, next)
  }
}
