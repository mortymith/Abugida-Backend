/**
 * @module health
 *
 * Health endpoints for the worker process. BullMQ workers are otherwise
 * headless, so the worker exposes a tiny HTTP surface that the container
 * healthcheck (and the ops tooling) can probe:
 *
 * - `GET /health`      — liveness: the process is running. Never fails.
 * - `GET /health/ready` — readiness: Redis is reachable and every expected
 *   queue worker has started.
 *
 * The paths match the convention used by `app/api` and the compose
 * healthchecks (ADR-028).
 */

import { Hono } from 'hono'

export interface HealthProvider {
  /** Deployed version label of the worker. */
  version(): string
  /** Queue names this worker instance is expected to consume. */
  expectedQueues(): string[]
  /** Queue names whose BullMQ worker has been started. */
  startedQueues(): string[]
  /** Whether the BullMQ worker is running. */
  isWorkerRunning(): boolean
  /** Whether Redis answers a ping. */
  isRedisReachable(): Promise<boolean>
}

interface HealthBody {
  status: 'ok' | 'degraded'
  uptime: number
  version: string
  timestamp: string
}

interface ReadinessBody extends HealthBody {
  checks: {
    redis: 'ok' | 'unavailable'
    worker: 'ok' | 'unavailable'
    queues: {
      expected: string[]
      started: string[]
    }
  }
}

const processStartedAt = Date.now()

/**
 * Create the worker's Hono health application.
 */
export function createHealthApp(provider: HealthProvider): Hono {
  const app = new Hono()

  app.get('/health', (c) => {
    const body: HealthBody = {
      status: 'ok',
      uptime: (Date.now() - processStartedAt) / 1000,
      version: provider.version(),
      timestamp: new Date().toISOString(),
    }
    return c.json(body)
  })

  app.get('/health/ready', async (c) => {
    const redis = (await provider.isRedisReachable()) ? 'ok' : 'unavailable'
    const expected = provider.expectedQueues()
    const started = provider.startedQueues()
    const worker = provider.isWorkerRunning() ? 'ok' : 'unavailable'

    const ready =
      redis === 'ok' && worker === 'ok' && expected.length > 0 && started.length === expected.length

    const body: ReadinessBody = {
      status: ready ? 'ok' : 'degraded',
      uptime: (Date.now() - processStartedAt) / 1000,
      version: provider.version(),
      timestamp: new Date().toISOString(),
      checks: {
        redis,
        worker,
        queues: { expected, started },
      },
    }

    return c.json(body, ready ? 200 : 503)
  })

  return app
}
