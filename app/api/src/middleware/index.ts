/**
 * @module middleware
 *
 * The API's middleware stack, composed in one place. `applyMiddleware()` is the
 * single registration point used by `app.ts`; ordering here is deliberate:
 *
 *   requestId → observability → logging → cors → timeout
 *     → /api/v1/*:  bodyLimit → withSession → rateLimit → requireAuth
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

export function applyMiddleware(app: AppHono, deps: MiddlewareDependencies): void {
  // ── Global chain (every request, every path) ─────────────────────────────
  app.use('*', requestIdMiddleware())
  app.use('*', observabilityMiddleware())
  app.use('*', loggingMiddleware())
  app.use('*', corsMiddleware())
  app.use('*', timeout(REQUEST_TIMEOUT_MS, requestTimedOut))

  // ── Versioned API routes ─────────────────────────────────────────────────
  app.use('/api/v1/*', bodyLimit({ maxSize: BODY_LIMIT_BYTES, onError: bodyTooLarge }))
  app.use('/api/v1/*', optionalSessionMiddleware(deps.auth))
  app.use('/api/v1/*', rateLimitMiddleware(deps.limiters))
  app.use('/api/v1/*', requireAuthMiddleware(deps.auth))

  // ── Webhook routes (API-key authenticated) ───────────────────────────────
  app.use('/webhooks/*', bodyLimit({ maxSize: BODY_LIMIT_BYTES, onError: bodyTooLarge }))
  app.use('/webhooks/*', apiKeyAuthMiddleware(deps.db))
  app.use('/webhooks/*', rateLimitMiddleware(deps.limiters))

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
