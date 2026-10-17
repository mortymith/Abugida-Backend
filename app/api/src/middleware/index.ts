/**
 * @module middleware
 *
 * The API's middleware stack, composed in one place. `applyMiddleware()` is the
 * single registration point used by `app.ts`; ordering here is deliberate:
 *
 *   requestId → observability → logging → cors → timeout
 *     → feature routes (root-level): bodyLimit → withSession → rateLimit → requireAuth
 *     → /webhooks/*: bodyLimit → apiKeyAuth → rateLimit
 *   then notFound/onError as the final catch-all.
 *
 * Everything is config-driven (see `src/config`); no middleware reads
 * `process.env`.
 */

import type { Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { timeout } from 'hono/timeout'
import { HTTPException } from 'hono/http-exception'
import { observabilityMiddleware } from '@abugida/observability/hono'
import type { AuthInstance } from '@abugida/auth'
import type { DatabaseClient } from '@abugida/database/client'
import type { RateLimiters } from '../config/rate-limit'
import { requestIdMiddleware } from './request-id.middleware'
import { loggingMiddleware } from './logging.middleware'
import { corsMiddleware } from './cors.middleware'
import { errorHandler, notFoundHandler, problemResponse } from './error-handler.middleware'
import { rateLimitMiddleware } from './rate-limit.middleware'
import { optionalSessionMiddleware, requireAuthMiddleware } from './auth.middleware'
import { apiKeyAuthMiddleware } from './api-key-auth.middleware'
import { requireApiKeyScope } from './api-key-auth.middleware'
import { csrfProtection } from '@abugida/auth/hono'
import type { AppEnv, AppHono } from './types'

/** Max request body — 10 MB per API spec (shared by API and webhook routes). */
const BODY_LIMIT_BYTES = 10 * 1024 * 1024

/** Request timeout — 30 seconds for standard routes. */
const REQUEST_TIMEOUT_MS = 30_000

const bodyTooLarge = (c: Context): Response =>
  problemResponse(c as Context<AppEnv>, {
    status: 413,
    detail: 'Request body exceeds the maximum allowed size.',
  })

const requestTimedOut = (c: Context): HTTPException =>
  new HTTPException(504, {
    message: 'The request timed out. Please try again later.',
    res: problemResponse(c as Context<AppEnv>, {
      status: 504,
      detail: 'The request timed out. Please try again later.',
    }),
  })

export interface MiddlewareDependencies {
  auth: AuthInstance
  db: DatabaseClient
  limiters: RateLimiters
}

/**
 * Every feature route is mounted at the root (no `/api/v1` prefix). The
 * session/rate-limit/auth stack is applied to those root prefixes below, with
 * public catalog GETs and the `/auth` flow let through by the allowlist in
 * `auth.middleware.ts`. Webhooks are authenticated separately by API key.
 */
const FEATURE_ROUTE_PREFIXES = [
  '/auth/*',
  '/users/*',
  '/courses/*',
  '/exam-types/*',
  '/tags/*',
  '/bundles/*',
  '/modules/*',
  '/lessons/*',
  '/resources/*',
  '/quiz/*',
  '/search/*',
  '/purchases/*',
  '/health*',
  '/doc*',
  '/openapi*',
]

export function applyMiddleware(app: AppHono, deps: MiddlewareDependencies): void {
  // ── Global chain (every request, every path) ─────────────────────────────
  app.use('*', requestIdMiddleware())
  app.use('*', observabilityMiddleware())
  app.use('*', loggingMiddleware())
  app.use('*', corsMiddleware())
  app.use('*', timeout(REQUEST_TIMEOUT_MS, requestTimedOut))

  // Tenant context propagation: after the session resolves, copy
  // `activeOrganizationId` onto `tenantOrgId` so every repository can scope
  // by it without re-reading the session. Runs after `optionalSessionMiddleware`
  // on feature routes; for webhook routes it runs after `apiKeyAuthMiddleware`.
  // This is a lightweight propagation, not a hostname-based resolver — the API
  // runs on a platform host (`api.*`), so tenant identity comes from the
  // session or API key, not the `Host` header.
  const propagateTenant = async (c: Context<AppEnv>, next: () => Promise<void>) => {
    const orgId = c.get('activeOrganizationId')
    c.set('tenantOrgId', orgId)
    await next()
  }

  // Reject cross-origin cookie-authenticated mutations before resolving a
  // session or touching application handlers. Better Auth's own endpoints are
  // excluded because it performs OAuth state and origin validation itself.
  // Requests carrying an `Authorization` header (bearer token) or an
  // `X-API-Key` header are also excluded: bearer/API-key requests are immune
  // to CSRF by construction, and the CSRF guard would reject them because
  // non-browser clients do not send an `Origin` header.
  app.use('*', async (c, next) => {
    if (c.req.path === '/auth' || c.req.path.startsWith('/auth/')) return next()
    if (c.req.path === '/webhooks' || c.req.path.startsWith('/webhooks/')) return next()
    // Bearer token → not a cookie-authenticated request; CSRF does not apply.
    const authHeader = c.req.header('Authorization')
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) return next()
    // API key → not a cookie-authenticated request; CSRF does not apply.
    if (c.req.header('X-API-Key')) return next()
    return csrfProtection(deps.auth)(c, next)
  })

  // ── Feature routes (root-level) ──────────────────────────────────────────
  for (const prefix of FEATURE_ROUTE_PREFIXES) {
    app.use(
      prefix,
      bodyLimit({ maxSize: BODY_LIMIT_BYTES, onError: bodyTooLarge }),
      optionalSessionMiddleware(deps.auth),
      propagateTenant,
      rateLimitMiddleware(deps.limiters),
      requireAuthMiddleware(deps.auth),
    )
  }

  // ── Webhook routes (API-key authenticated + scope-enforced) ──────────────
  // Each webhook source requires its own scope: `webhooks:telebirr` for
  // payment callbacks, `webhooks:sms` for SMS delivery receipts. A key with
  // the wrong scope gets 403 — the documented but previously dead-code path.
  app.use('/webhooks/telebirr', bodyLimit({ maxSize: BODY_LIMIT_BYTES, onError: bodyTooLarge }))
  app.use('/webhooks/telebirr', apiKeyAuthMiddleware(deps.db))
  app.use('/webhooks/telebirr', requireApiKeyScope('webhooks:telebirr'))
  app.use('/webhooks/telebirr', propagateTenant)
  app.use('/webhooks/telebirr', rateLimitMiddleware(deps.limiters))

  app.use('/webhooks/sms-delivery', bodyLimit({ maxSize: BODY_LIMIT_BYTES, onError: bodyTooLarge }))
  app.use('/webhooks/sms-delivery', apiKeyAuthMiddleware(deps.db))
  app.use('/webhooks/sms-delivery', requireApiKeyScope('webhooks:sms'))
  app.use('/webhooks/sms-delivery', propagateTenant)
  app.use('/webhooks/sms-delivery', rateLimitMiddleware(deps.limiters))

  // ── Final catch-alls ─────────────────────────────────────────────────────
  app.notFound(notFoundHandler())
  app.onError(errorHandler())
}

// Re-export the shared types and select helpers for route modules and tests.
export type { AppEnv, AppHono, AppVariables, ResolvedApiKey } from './types'
export type {
  ProblemDetails,
  ProblemErrorField,
  ProblemResponseOptions,
} from './error-handler.middleware'
export { problemResponse, zodOpenApiHook } from './error-handler.middleware'
export { uuidv7 } from './request-id.middleware'
