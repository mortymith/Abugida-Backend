/**
 * @module index
 *
 * API entry point. Initializes configuration (validated up-front), boots the
 * observability stack, starts the Hono server, and wires graceful shutdown.
 *
 * Environment loading/validation happens in `./config/app_config` — nothing
 * here reads `process.env` for application configuration.
 */

import { appConfig } from './config/app_config'
import { init, shutdown, logger } from './config/observability'
import { pool } from './config/database'
import { createApp } from './app'

await init()

let server: ReturnType<typeof Bun.serve>
let queue: Awaited<ReturnType<typeof createApp>>['queue']
let storage: Awaited<ReturnType<typeof createApp>>['storage']

try {
  const app = createApp()
  queue = app.queue
  storage = app.storage

  server = Bun.serve({
    hostname: appConfig.HOST,
    port: appConfig.PORT,
    fetch: (req, server) => app.app.fetch(req, server),
  })

  logger.info(
    { hostname: server.hostname, port: server.port, environment: appConfig.NODE_ENV },
    'API server listening',
  )
} catch (err) {
  logger.fatal({ err }, 'Failed to start API server')
  process.exit(1)
}

let shuttingDown = false

async function shutdownServer(): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true

  logger.info('Shutting down API server…')

  try {
    await queue?.close()
  } catch (err) {
    logger.warn({ err }, 'Error closing queue during shutdown')
  }

  try {
    await storage?.destroy()
  } catch (err) {
    logger.warn({ err }, 'Error destroying storage during shutdown')
  }

  try {
    await pool.end()
  } catch (err) {
    logger.warn({ err }, 'Error closing database pool during shutdown')
  }

  try {
    await shutdown()
  } catch (err) {
    logger.warn({ err }, 'Error shutting down observability during shutdown')
  }
}

function handleSignal(signal: string): void {
  logger.info({ signal }, 'Received signal, initiating graceful shutdown')
  shutdownServer()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.fatal({ err }, 'Error during graceful shutdown')
      process.exit(1)
    })
}

process.on('SIGTERM', () => handleSignal('SIGTERM'))
process.on('SIGINT', () => handleSignal('SIGINT'))
