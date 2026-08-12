/**
 * @module middleware/tanstack/client
 * @description TanStack Start integration for the queue client.
 * Provides a singleton queue client accessible from server functions
 * and API routes in TanStack Start.
 */

import type { QueueClient } from "../../core/types.js";
import type { QueueConfig } from "../../config/schema.js";
import { createQueueClient } from "../../core/client.js";

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _client: QueueClient | null = null;

/**
 * Get or create the singleton queue client for TanStack Start.
 * Safe to call multiple times — returns the same instance.
 *
 * @example
 * ```ts
 * import { getTanStackQueueClient } from "@abugida/queue/tanstack";
 *
 * export async function enqueueExport(userId: string) {
 *   const queue = getTanStackQueueClient(config);
 *   await queue.enqueue("DATA_EXPORT", { userId, format: "json", ... });
 * }
 * ```
 */
export function getTanStackQueueClient(config: QueueConfig): QueueClient {
  if (!_client) {
    _client = createQueueClient(config);
  }
  return _client;
}

/**
 * Close the TanStack Start queue client singleton.
 * Call during server shutdown.
 */
export async function closeTanStackQueueClient(): Promise<void> {
  if (_client) {
    await _client.close();
    _client = null;
  }
}

/**
 * Create a fresh queue client (bypasses singleton).
 * Useful for testing or isolated contexts.
 */
export function createTanStackQueueClient(config: QueueConfig): QueueClient {
  return createQueueClient(config);
}
