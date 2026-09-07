/**
 * @example hono/worker
 * @description Example of running a queue worker alongside a Hono API
 * with health check routes.
 */

import { createHonoWorker, mergeWithDefaults } from '../../../src/index.js'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const config = mergeWithDefaults({
  redis: {
    hostname: 'localhost',
    port: 6379,
  },
  logging: { level: 'info', format: 'pretty' },
})

// ---------------------------------------------------------------------------
// Create Worker with Health Routes
// ---------------------------------------------------------------------------

const { app, worker, start, stop } = createHonoWorker({
  config,
})

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function main() {
  console.log('[example:hono:worker] Starting worker with health check routes…')

  await start()

  console.log('[example:hono:worker] Worker is running!')

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('\n[example:hono:worker] Shutting down…')
    await stop()
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    console.log('\n[example:hono:worker] Interrupted. Shutting down…')
    await stop()
    process.exit(0)
  })
}

// In a real app, you would also serve healthApp on a port:
// serve(healthApp, { port: 3001 });

console.log('[example:hono:worker] Worker example (not actually starting)')
console.log('In a real app, call main() to start the worker.')
