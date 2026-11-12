/**
 * @module index
 *
 * Worker entry point. Reads the validated configuration, starts the queue
 * consumer for the selected queues, exposes the health endpoints and wires
 * graceful shutdown.
 *
 * The order is deliberate:
 *   env → config → processors → worker → health → shutdown
 *
 * Nothing here reads `process.env` directly — the validated configuration
 * lives in `./config/env`.
 */

import { createConnection, closeAllConnections } from '@abugida/queue'
import type { RedisClient } from 'bun'

import { workerEnv } from '@/config/env'
import { queueConfig } from '@/config/queue'
import { init, shutdown, logger } from '@/config/observability'
import { createHealthApp } from '@/runtime/health'
import { selectProcessors } from '@/runtime/queues'
import { registerGracefulShutdown } from '@/runtime/shutdown'
import { createWorker } from '@/runtime/worker'

await init()

const selection = selectProcessors(workerEnv.WORKER_QUEUES)
const handle = createWorker(queueConfig, selection.processors, selection.queues)

// Dedicated connection for the readiness probe. It is purpose-tagged so it
// never collides with the producer or consumer connections.
let healthRedis: RedisClient | undefined
try {
  healthRedis = createConnection(queueConfig, 'health')
} catch (err) {
  logger.warn({ err }, 'Health Redis connection unavailable — readiness will report degraded')
}

const healthApp = createHealthApp({
  version: () => workerEnv.OTEL_SERVICE_VERSION,
  expectedQueues: () => selection.queues,
  startedQueues: () => handle.activeQueues(),
  isWorkerRunning: () => handle.isRunning(),
  isRedisReachable: async () => {
    if (!healthRedis) return false
    try {
      await healthRedis.ping()
      return true
    } catch {
      return false
    }
  },
})

let server: ReturnType<typeof Bun.serve> | undefined

try {
  await handle.start()

  server = Bun.serve({
    hostname: '0.0.0.0',
    port: workerEnv.PORT,
    fetch: healthApp.fetch,
  })

  logger.info(
    {
      queues: selection.queues,
      processors: selection.processors.length,
      port: server.port,
      environment: workerEnv.NODE_ENV,
    },
    'Worker started',
  )
} catch (err) {
  logger.fatal({ err }, 'Failed to start worker')
  process.exit(1)
}

registerGracefulShutdown({
  stopWorker: () => handle.stop(),
  stopHealthServer: async () => {
    server?.stop(true)
  },
  closeConnections: async () => {
    await closeAllConnections()
  },
  shutdownTelemetry: () => shutdown(),
  log: (message, err) => {
    if (err) {
      logger.error({ err }, message)
    } else {
      logger.info(message)
    }
  },
  onShutdownComplete: () => {
    process.exit(0)
  },
})
