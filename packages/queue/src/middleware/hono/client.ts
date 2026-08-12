/**
 * @module middleware/hono/client
 * @description Hono middleware integration for the queue client (producer).
 * Provides a factory function that attaches a queue client to Hono's
 * app context and exposes helper methods for enqueuing jobs from routes.
 */

import type { QueueClient } from "../../core/types.js";
import type { QueueConfig } from "../../config/schema.js";
import { createQueueClient } from "../../core/client.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Hono app context augmented with queue client. */
export interface HonoQueueContext {
  /** The queue client bound to this Hono app. */
  queue: QueueClient;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a queue client for use within a Hono API.
 *
 * @example
 * ```ts
 * import { Hono } from "hono";
 * import { createHonoQueueClient } from "@abugida/queue/hono";
 *
 * const app = new Hono<{ Variables: HonoQueueContext }>();
 * const queueClient = createHonoQueueClient(config);
 *
 * // In a route:
 * app.post("/api/purchases", async (c) => {
 *   const jobId = await c.get("queue").enqueue(
 *     "PURCHASE_INITIATE",
 *     { userId: "123", courseId: "456", ... }
 *   );
 *   return c.json({ jobId });
 * });
 * ```
 */
export function createHonoQueueClient(config: QueueConfig): QueueClient {
  return createQueueClient(config);
}

/**
 * Hono middleware that injects the queue client into the app context.
 *
 * @example
 * ```ts
 * import { createQueueMiddleware } from "@abugida/queue/hono";
 *
 * const app = new Hono<{ Variables: HonoQueueContext }>();
 * app.use("*", createQueueMiddleware(config));
 *
 * app.post("/api/webhooks/telebirr", async (c) => {
 *   const queue = c.get("queue");
 *   await queue.enqueue("WEBHOOK_PROCESS", { ... });
 *   return c.json({ ok: true });
 * });
 * ```
 */
export function createQueueMiddleware(config: QueueConfig) {
  const client = createQueueClient(config);

  return async function queueMiddleware(
    _c: { set: (key: string, value: unknown) => void },
    _next: () => Promise<void>
  ) {
    _c.set("queue", client);
    await _next();
  };
}
