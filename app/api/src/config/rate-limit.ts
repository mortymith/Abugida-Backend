/**
 * @module rate-limit
 *
 * API-specific rate limiting configuration, aligned with the API specification
 * (NFR-403):
 *
 *   - Authenticated users:   100 requests per minute
 *   - Unauthenticated IPs: 1000 requests per minute
 *
 * This module owns the *configuration* and limiter factories. Hono middleware
 * wiring lives separately in `src/middleware` so the two stay decoupled.
 *
 * Two store backends are supported behind one minimal `RateLimiter` interface:
 *
 *   - `createRedisRateLimiter()` — distributed fixed-window limiter backed by
 *     Bun's native `RedisClient` (INCR + EXPIRE + PTTL). This is the production
 *     path: with multiple API replicas behind the edge, in-memory counters are
 *     per-process and would let every replica grant its own quota.
 *   - `createMemoryRateLimiter()` — per-process limiter built on
 *     `rate-limiter-flexible`'s `RateLimiterMemory`. Used when no Redis
 *     connection is available (local development, degraded boot).
 *
 * `createRateLimiters()` picks the backend automatically.
 *
 * Direction:
 *   app_config → rate-limit → middleware
 */

import type { RedisClient } from 'bun'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import { appConfig } from './app_config'

export interface RateLimitLimits {
  /** Shared window length in seconds. */
  windowSeconds: number
  /** Requests allowed within the window for authenticated callers. */
  authenticated: { points: number; duration: number }
  /** Requests allowed within the window per unauthenticated IP. */
  anonymous: { points: number; duration: number }
}

export const rateLimitConfig = {
  windowSeconds: appConfig.RATE_LIMIT_WINDOW_SECONDS,
  authenticated: {
    points: appConfig.RATE_LIMIT_AUTHENTICATED_PER_MINUTE,
    duration: appConfig.RATE_LIMIT_WINDOW_SECONDS,
  },
  anonymous: {
    points: appConfig.RATE_LIMIT_ANONYMOUS_PER_MINUTE,
    duration: appConfig.RATE_LIMIT_WINDOW_SECONDS,
  },
} as const satisfies RateLimitLimits

// ---------------------------------------------------------------------------
// Store-agnostic limiter contract
// ---------------------------------------------------------------------------

export interface RateLimitConsumeResult {
  /** Requests still allowed within the current window (0 when exhausted). */
  remainingPoints: number
  /** Milliseconds until the window resets. */
  msBeforeNext: number
}

/** Thrown by `consume()` when the window is exhausted. */
export class RateLimitExceededError extends Error {
  readonly msBeforeNext: number

  constructor(msBeforeNext: number) {
    super('Rate limit exceeded.')
    this.name = 'RateLimitExceededError'
    this.msBeforeNext = msBeforeNext
  }
}

export interface RateLimiter {
  readonly keyPrefix: string
  readonly points: number
  readonly duration: number
  consume(key: string): Promise<RateLimitConsumeResult>
}

export interface RateLimiters {
  authenticated: RateLimiter
  anonymous: RateLimiter
}

// ---------------------------------------------------------------------------
// Redis backend (Bun's native RedisClient)
// ---------------------------------------------------------------------------

/**
 * Distributed fixed-window limiter over Bun's `RedisClient`.
 *
 * Algorithm: `INCR key` then, only when the counter was just created, `EXPIRE`.
 * `PTTL` provides the window-reset timestamp. Fixed windows match the spec's
 * "requests per minute" semantics and are atomic per key without Lua.
 */
export function createRedisRateLimiter(
  redis: RedisClient,
  options: { keyPrefix: string; points: number; duration: number },
): RateLimiter {
  const { keyPrefix, points, duration } = options

  return {
    keyPrefix,
    points,
    duration,
    async consume(key) {
      const rlKey = `${keyPrefix}:${key}`
      const consumed = await redis.incr(rlKey)

      if (consumed === 1) {
        await redis.expire(rlKey, duration)
      }

      const ttlMs = await redis.pttl(rlKey)
      const msBeforeNext = ttlMs < 0 ? duration * 1000 : ttlMs

      if (consumed > points) {
        throw new RateLimitExceededError(msBeforeNext)
      }

      return { remainingPoints: Math.max(points - consumed, 0), msBeforeNext }
    },
  }
}

// ---------------------------------------------------------------------------
// In-memory backend (rate-limiter-flexible)
// ---------------------------------------------------------------------------

function isRejectResult(
  value: unknown,
): value is { msBeforeNext: number; remainingPoints: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'msBeforeNext' in value &&
    'remainingPoints' in value &&
    !(value instanceof Error)
  )
}

export function createMemoryRateLimiter(options: {
  keyPrefix: string
  points: number
  duration: number
}): RateLimiter {
  const { keyPrefix, points, duration } = options
  const inner = new RateLimiterMemory({ keyPrefix, points, duration })

  return {
    keyPrefix,
    points,
    duration,
    async consume(key) {
      try {
        const res = await inner.consume(key)
        return { remainingPoints: res.remainingPoints, msBeforeNext: res.msBeforeNext }
      } catch (rejected) {
        if (isRejectResult(rejected)) {
          throw new RateLimitExceededError(rejected.msBeforeNext)
        }
        throw rejected
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Build the limiter pair. With a Bun `RedisClient`, Redis-backed (distributed)
 * limiters are returned; otherwise in-memory limiters keep the API usable in
 * development and single-instance deployments.
 */
export function createRateLimiters(redis?: RedisClient): RateLimiters {
  if (redis) {
    const common = { redis, duration: rateLimitConfig.authenticated.duration }
    return {
      authenticated: createRedisRateLimiter(redis, {
        ...common,
        keyPrefix: 'abugida:rl:authenticated',
        points: rateLimitConfig.authenticated.points,
      }),
      anonymous: createRedisRateLimiter(redis, {
        ...common,
        keyPrefix: 'abugida:rl:anonymous',
        points: rateLimitConfig.anonymous.points,
      }),
    }
  }

  return {
    authenticated: createMemoryRateLimiter({
      keyPrefix: 'abugida:rl:authenticated',
      points: rateLimitConfig.authenticated.points,
      duration: rateLimitConfig.authenticated.duration,
    }),
    anonymous: createMemoryRateLimiter({
      keyPrefix: 'abugida:rl:anonymous',
      points: rateLimitConfig.anonymous.points,
      duration: rateLimitConfig.anonymous.duration,
    }),
  }
}
