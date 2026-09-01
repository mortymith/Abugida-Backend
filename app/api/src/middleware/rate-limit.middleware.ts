/**
 * @module rate-limit
 *
 * Hono middleware applying the API spec's rate limits (NFR-403):
 *
 *   - authenticated callers:   100 requests/minute (keyed by user id)
 *   - webhook API keys:        100 requests/minute (keyed by api-key public id)
 *   - unauthenticated IPs:    1000 requests/minute (keyed by client IP)
 *
 * The limiter pair comes from `src/config/rate-limit.ts` (Redis-backed in
 * production for cross-replica correctness, in-memory fallback in dev). On
 * success the middleware sets `X-RateLimit-Limit/-Remaining/-Reset`; when the
 * window is exhausted it responds 429 problem+json with a `Retry-After` header.
 */

import type { Context, MiddlewareHandler } from 'hono'
import { getConnInfo } from 'hono/bun'
import { appConfig } from '../config/app_config'
import { logger } from '../config/observability'
import { RateLimitExceededError, type RateLimiter, type RateLimiters } from '../config/rate-limit'
import { problemResponse } from './error-handler.middleware'
import type { AppEnv } from './types'

/**
 * Resolve the caller's IP. When `TRUST_PROXY` is enabled (behind Caddy),
 * `X-Forwarded-For` (first hop) is authoritative; `X-Real-IP` and the
 * connection info are fallbacks. When disabled, only the raw connection
 * address is used — spoofed headers are ignored.
 */
function getClientIp(c: Context<AppEnv>): string {
  if (appConfig.TRUST_PROXY) {
    const forwarded = c.req.header('x-forwarded-for')
    if (forwarded) {
      const first = forwarded.split(',')[0]?.trim()
      if (first) return first
    }

    const realIp = c.req.header('x-real-ip')
    if (realIp) return realIp
  }

  try {
    const info = getConnInfo(c)
    if (info.remote.address) return info.remote.address
  } catch {
    // No Bun server binding — fall through to a stable placeholder.
  }

  // Use a per-request ID so multiple unidentified clients don't share a single
  // rate-limit bucket, which would be a DDoS amplification vector.
  return `anon:${c.get('requestId') ?? 'no-id'}`
}

export function rateLimitMiddleware(limiters: RateLimiters): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get('user')
    const apiKey = c.get('apiKey')

    let limiter: RateLimiter
    let key: string

    if (user) {
      limiter = limiters.authenticated
      key = `user:${user.id}`
    } else if (apiKey) {
      limiter = limiters.authenticated
      key = `key:${apiKey.publicId}`
    } else {
      limiter = limiters.anonymous
      key = `ip:${getClientIp(c)}`
    }

    const setHeaders = (remaining: number, msBeforeNext: number): void => {
      const resetAt = Math.ceil(Date.now() / 1000) + Math.ceil(msBeforeNext / 1000)
      c.header('X-RateLimit-Limit', String(limiter.points))
      c.header('X-RateLimit-Remaining', String(remaining))
      c.header('X-RateLimit-Reset', String(resetAt))
    }

    try {
      const result = await limiter.consume(key)
      setHeaders(result.remainingPoints, result.msBeforeNext)
      await next()
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        setHeaders(0, error.msBeforeNext)
        const retryAfter = Math.max(1, Math.ceil(error.msBeforeNext / 1000))
        c.header('Retry-After', String(retryAfter))
        return problemResponse(c, {
          status: 429,
          detail: `Rate limit exceeded. Retry after ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`,
          title: 'Too Many Requests',
        })
      }

      // Store/connection failure: fail open so the API stays available (the
      // edge rate-limiter still provides a baseline). Log once per request at
      // warn; ops alerting should flag persistent limiter outages.
      logger.warn(
        {
          requestId: c.get('requestId'),
          err: error instanceof Error ? error.message : String(error),
        },
        'Rate limiter store unavailable — allowing request',
      )
      return next()
    }
  }
}
