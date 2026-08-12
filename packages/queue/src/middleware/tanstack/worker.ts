/**
 * @module middleware/tanstack/worker
 * @description TanStack Start worker setup for running queue consumers
 * in the dashboard application. Provides server-side worker lifecycle
 * management and graceful shutdown.
 */

import type { QueueWorker } from "../../core/types.js";
import type { QueueConfig } from "../../config/schema.js";
import { createQueueWorker } from "../../core/worker.js";
import { allProcessors } from "../../processors/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TanStackWorkerOptions {
  /** Queue configuration. */
  config: QueueConfig;
  /** Custom processors (defaults to all). */
  processors?: import("../../core/types.js").AnyProcessorEntry[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a TanStack Start worker for processing background jobs.
 *
 * @example
 * ```ts
 * // server.ts or entry-server.tsx
 * import { createTanStackWorker } from "@abugida/queue/tanstack/worker";
 *
 * const worker = createTanStackWorker({ config: queueConfig });
 *
 * // Start on server boot
 * await worker.start();
 *
 * // Graceful shutdown
 * process.on("SIGTERM", async () => {
 *   await worker.stop();
 *   process.exit(0);
 * });
 * ```
 */
export function createTanStackWorker(options: TanStackWorkerOptions): QueueWorker {
  const { config, processors = allProcessors } = options;
  return createQueueWorker(config, processors);
}

/**
 * Helper to set up process-level signal handlers for graceful shutdown.
 *
 * @example
 * ```ts
 * import { createTanStackWorker, setupGracefulShutdown } from "@abugida/queue/tanstack/worker";
 *
 * const worker = createTanStackWorker({ config });
 * setupGracefulShutdown(worker);
 * ```
 */
export function setupGracefulShutdown(worker: QueueWorker): void {
  const shutdown = async (signal: string) => {
    console.log(`\n[queue:shutdown] Received ${signal}. Shutting down gracefully…`);
    try {
      await worker.stop();
      console.log("[queue:shutdown] Worker stopped successfully.");
      process.exit(0);
    } catch (err) {
      console.error("[queue:shutdown] Error during shutdown:", err);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
