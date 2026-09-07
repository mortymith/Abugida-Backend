/**
 * @module middleware/hono/worker
 * @description Hono worker setup for running queue consumers alongside
 * a Hono API. Provides health check routes and graceful shutdown hooks.
 */

import { Hono } from 'hono'
import type { QueueWorker } from '../../core/types.js'
import type { QueueConfig } from '../../config/schema.js'
import { createQueueWorker } from '../../core/worker.js'
import { allProcessors } from '../../processors/index.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HonoWorkerOptions {
  /** Queue configuration. */
  config: QueueConfig
  /** Custom processors (defaults to all). */
  processors?: import('../../core/types.js').AnyProcessorEntry[]
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a Hono-based worker that processes jobs and optionally exposes
 * health check routes.
 *
 * @example
 * ```ts
 * import { createHonoWorker } from "@abugida/queue/hono/worker";
 *
 * const { app, worker } = createHonoWorker({
 *   config: queueConfig,
 *   enableHealthRoutes: true,
 * });
 *
 * // Start worker
 * await worker.start();
 *
 * // Serve health checks via Hono
 * // GET /health/queue → JSON health status
 * // GET /health/queue/dashboard → HTML dashboard
 * ```
 */
export function createHonoWorker(options: HonoWorkerOptions): {
  app: Hono
  worker: QueueWorker
  start: () => Promise<void>
  stop: () => Promise<void>
} {
  const { config, processors = allProcessors } = options
  const worker = createQueueWorker(config, processors)
  const app = new Hono()

  return {
    app,
    worker,
    start: async () => {
      await worker.start()
    },
    stop: async () => {
      await worker.stop()
    },
  }
}
