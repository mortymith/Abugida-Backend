/**
 * @module app
 *
 * Hono application composition. Wires the shared auth, observability, database,
 * queue and storage infrastructure together, applies the API middleware stack
 * (`src/middleware`) and exposes the HTTP endpoints.
 *
 * Configuration lives in `./config`; this module only consumes it.
 */

import { OpenAPIHono, extendZodWithOpenApi } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { z } from 'zod'
import { mountAuthRoutes } from '@abugida/auth/hono'
import { createConnection } from '@abugida/queue'
import type { RedisClient } from 'bun'
import { createStorage, type Storage, type StorageConfig } from '@abugida/storage'
import type { QueueClient } from '@abugida/queue'
import { appConfig } from './config/app_config'
import { createAuthInstance } from './config/auth'
import { db, pool } from './config/database'
import { createQueue } from './config/queue'
import { queueConfig } from './config/queue'
import { logger } from './config/observability'
import { createRateLimiters } from './config/rate-limit'
import { applyMiddleware, zodOpenApiHook, type AppEnv } from './middleware'
import { healthRoute } from './routes/health'
import { rootRoute } from './routes/root'

extendZodWithOpenApi(z)

/**
 * Build the S3-compatible storage config from validated application config.
 * Returns `undefined` when storage is not configured, keeping the API
 * operational without object storage (graceful degradation).
 */
function buildStorageConfig(): StorageConfig | undefined {
  if (!appConfig.STORAGE_PROVIDER) return undefined
  return {
    provider: appConfig.STORAGE_PROVIDER,
    endpoint: appConfig.STORAGE_ENDPOINT!,
    region: appConfig.STORAGE_REGION,
    accessKeyId: appConfig.STORAGE_ACCESS_KEY_ID ?? '',
    secretAccessKey: appConfig.STORAGE_SECRET_ACCESS_KEY ?? '',
    bucket: appConfig.STORAGE_BUCKET ?? '',
    forcePathStyle: appConfig.STORAGE_FORCE_PATH_STYLE,
    ...(appConfig.STORAGE_MAX_ATTEMPTS !== undefined
      ? { maxAttempts: appConfig.STORAGE_MAX_ATTEMPTS }
      : {}),
    ...(appConfig.STORAGE_REQUEST_TIMEOUT !== undefined
      ? { requestTimeout: appConfig.STORAGE_REQUEST_TIMEOUT }
      : {}),
    ...(appConfig.STORAGE_CONNECTION_TIMEOUT !== undefined
      ? { connectionTimeout: appConfig.STORAGE_CONNECTION_TIMEOUT }
      : {}),
  }
}

export interface ApiApplication {
  app: OpenAPIHono<AppEnv>
  queue?: QueueClient | undefined
  storage?: Storage | undefined
}

/**
 * Create the fully wired Hono application. Fails fast when authentication
 * cannot be configured (e.g. no OAuth provider is present). The rate limiter
 * falls back to in-memory limiters when the shared Redis connection cannot be
 * created, so the API still boots for local development.
 */
export function createApp(): ApiApplication {
  const auth = createAuthInstance()

  let queue: QueueClient | undefined
  let storage: Storage | undefined

  try {
    queue = createQueue()
  } catch (err) {
    logger.warn({ error: (err as Error).message }, 'Queue unavailable — skipping')
  }

  try {
    const storageConfig = buildStorageConfig()
    if (storageConfig) storage = createStorage(storageConfig)
  } catch (err) {
    logger.warn({ error: (err as Error).message }, 'Storage unavailable — skipping')
  }

  let rateLimitRedis: RedisClient | undefined
  try {
    // Reuse the shared queue Redis connection (Bun's native client). Lazily
    // connects on first command; purpose-tagged so it doesn't collide with the
    // producer/worker connections.
    rateLimitRedis = createConnection(queueConfig, 'rate-limit')
  } catch (err) {
    logger.warn(
      { error: (err as Error).message },
      'Rate-limit Redis unavailable — using in-memory limiters',
    )
  }
  const limiters = createRateLimiters(rateLimitRedis)

  const app = new OpenAPIHono<AppEnv>({
    defaultHook: zodOpenApiHook,
  })

  applyMiddleware(app, { auth, db, limiters })

  // Mount auth routes — the shared package uses its own Hono types which are
  // compatible with AppEnv but not structurally identical. The cast bridges the
  // minor type gap without losing safety at the boundary.
  mountAuthRoutes(app as unknown as Parameters<typeof mountAuthRoutes>[0], auth)

  // ── OpenAPI-documented routes ───────────────────────────────────────────

  app.openapi(rootRoute, (c) => c.text('Hello Hono!'))

  app.openapi(healthRoute, async (c) => {
    const checks = { api: 'up' as const }

    const [postgres, queueStatus, storageStatus] = await Promise.all([
      checkPostgres(),
      checkQueue(queue),
      checkStorage(storage),
    ])

    const allUp = [postgres, queueStatus, storageStatus].every(
      (v) => v === 'up' || v === 'disabled',
    )

    return c.json(
      { ...checks, postgres, queue: queueStatus, storage: storageStatus },
      allUp ? 200 : 503,
    )
  })

  // ── Documentation endpoints (development only) ──────────────────────────

  if (appConfig.NODE_ENV !== 'production') {
    app.doc31('/docs', {
      openapi: '3.1.0',
      info: {
        title: 'Abugida API',
        version: appConfig.OTEL_SERVICE_VERSION,
        description:
          'Abugida Learning Platform REST API. This documentation is auto-generated from route definitions and Zod schemas.',
        contact: {
          name: 'Abugida Engineering',
        },
        license: {
          name: 'MIT',
        },
      },
      servers: [
        {
          url: `http://${appConfig.HOST}:${appConfig.PORT}`,
          description: 'Local development server',
        },
      ],
    })

    app.use(
      '/scalar',
      Scalar({
        url: '/docs',
        pageTitle: 'Abugida API — Scalar Reference',
      }),
    )
  }

  return { app, queue, storage }
}

// ── Health-check helpers ─────────────────────────────────────────────────

async function checkPostgres(): Promise<'up' | 'down'> {
  try {
    await pool.query('SELECT 1')
    return 'up'
  } catch {
    return 'down'
  }
}

async function checkQueue(queue: QueueClient | undefined): Promise<'up' | 'down' | 'disabled'> {
  if (!queue) return 'disabled'
  try {
    await queue.getQueueLength(appConfig.HEALTH_CHECK_QUEUE_NAME)
    return 'up'
  } catch {
    return 'down'
  }
}

async function checkStorage(storage: Storage | undefined): Promise<'up' | 'down' | 'disabled'> {
  if (!storage) return 'disabled'
  try {
    const health = await storage.health()
    return health.healthy ? 'up' : 'down'
  } catch {
    return 'down'
  }
}
