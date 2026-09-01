/**
 * @module api-key-auth
 *
 * API-key authentication for webhook endpoints. The spec authenticates
 * `/webhooks/*` via the `X-API-Key` header, validated against the
 * `ops.api_keys` table (shared `@abugida/database` schema).
 *
 * The presented key is hashed (SHA-256 hex) and compared to the stored
 * `key_hash`; the entry must be active and unexpired. On success the resolved
 * principal is stored as `c.get("apiKey")` for downstream handlers and the
 * rate limiter. `last_used_at` is refreshed best-effort.
 *
 * Note: the spec describes keys with `principal_type = 'integration'`, but the
 * current `api_keys` table has no such column — it links keys to a user via
 * `user_id`. Validation here relies on `is_active`/`expires_at` until that
 * schema gap is closed.
 */

import type { MiddlewareHandler } from 'hono'
import { and, eq } from 'drizzle-orm'
import { apiKeys } from '@abugida/database/ops'
import type { DatabaseClient } from '@abugida/database/client'
import { logger } from '../config/observability'
import { problemResponse } from './error-handler.middleware'
import type { AppEnv, ResolvedApiKey } from './types'

async function hashApiKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function toScopes(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : []
}

export function apiKeyAuthMiddleware(db: DatabaseClient): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const presented = c.req.header('X-API-Key')

    if (!presented) {
      return problemResponse(c, { status: 401, detail: 'Missing X-API-Key header.' })
    }

    const hash = await hashApiKey(presented)

    let row
    try {
      ;[row] = await db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.keyHash, hash), eq(apiKeys.isActive, true)))
        .limit(1)
    } catch (err) {
      logger.error({ err, requestId: c.get('requestId') }, 'API key lookup failed')
      return problemResponse(c, {
        status: 500,
        detail: 'An unexpected error occurred. Please try again later.',
      })
    }

    if (!row) {
      return problemResponse(c, { status: 401, detail: 'Invalid API key.' })
    }

    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      return problemResponse(c, { status: 401, detail: 'API key has expired.' })
    }

    const resolved: ResolvedApiKey = {
      publicId: row.publicId,
      name: row.name,
      userId: row.userId,
      scopes: toScopes(row.scopes),
      rateLimit: row.rateLimit,
      keyPrefix: row.keyPrefix,
    }

    c.set('apiKey', resolved)

    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, row.id))
      .catch((err) => {
        logger.warn({ err, apiKeyId: row.publicId }, 'Failed to update API key last_used_at')
      })

    return next()
  }
}
