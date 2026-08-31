import 'dotenv/config'

import { Pool } from 'pg'
import { Hono } from 'hono'
import { createAuth, parseEnvironment } from '@abugida/auth'
import { mountAuthRoutes, type HonoAuthVariables } from '@abugida/auth/hono'
import { createClient } from '@abugida/database/client'
import { authSchema } from '@abugida/database/auth'
import { mergeWithDefaults, createQueueClient, type QueueClient } from '@abugida/queue'
import {
  createStorage,
  configFromEnv as storageConfigFromEnv,
  type Storage,
} from '@abugida/storage'

const db = createClient(process.env.DATABASE_URL!)

function buildAuthConfig() {
  const issuer = process.env.AUTH_BASE_URL
  const audience = process.env.TOKEN_AUDIENCE

  return {
    environment: parseEnvironment(process.env.ENVIRONMENT),
    baseUrl: process.env.BETTER_AUTH_URL!,
    secret: process.env.BETTER_AUTH_SECRET!,
    database: { db, schema: authSchema, provider: 'pg' as const },
    providers: {},
    cors: {
      origins: process.env.WEB_APP_URL ? [process.env.WEB_APP_URL] : [],
      credentials: true,
    },
    rateLimit: { max: 100, windowSeconds: 60 },
    ...(issuer || audience
      ? { tokens: { ...(issuer ? { issuer } : {}), ...(audience ? { audience } : {}) } }
      : {}),
  }
}

const auth = createAuth(buildAuthConfig())

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const redisPassword = process.env.REDIS_PASSWORD

const queueConfig = mergeWithDefaults({
  redis: {
    hostname: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    db: Number(process.env.REDIS_DB ?? 0),
    ...(redisPassword ? { password: redisPassword } : {}),
  },
})

let queue: QueueClient | undefined
let storage: Storage | undefined

try {
  queue = createQueueClient(queueConfig)
} catch (err) {
  console.warn('[api] queue unavailable — skipping:', (err as Error).message)
}

try {
  storage = createStorage(storageConfigFromEnv())
} catch (err) {
  console.warn('[api] storage unavailable — skipping:', (err as Error).message)
}

const app = new Hono<{ Bindings: Record<string, unknown>; Variables: HonoAuthVariables }>()

mountAuthRoutes(app, auth)

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/health', async (c) => {
  const checks: Record<string, string> = { api: 'up' }

  try {
    await pool.query('SELECT 1')
    checks.postgres = 'up'
  } catch {
    checks.postgres = 'down'
  }

  if (queue) {
    try {
      await queue.getQueueLength('abugida.purchases')
      checks.queue = 'up'
    } catch {
      checks.queue = 'down'
    }
  } else {
    checks.queue = 'disabled'
  }

  if (storage) {
    try {
      const health = await storage.health()
      checks.storage = health.healthy ? 'up' : 'down'
    } catch {
      checks.storage = 'down'
    }
  } else {
    checks.storage = 'disabled'
  }

  const allUp = Object.values(checks).every((v) => v === 'up' || v === 'disabled')
  return c.json(checks, allUp ? 200 : 503)
})

const port = Number(process.env.PORT ?? 3000)
const server = Bun.serve({
  port,
  fetch: app.fetch,
})

console.log(`[api] listening on http://${server.hostname}:${server.port}`)
