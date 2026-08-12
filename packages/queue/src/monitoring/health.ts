/**
 * @module monitoring/health
 * @description Health check utilities for queue and Redis monitoring.
 * Produces structured {@link QueueHealthReport} objects.
 */

import type { QueueConfig } from "../config/schema.js";
import type { QueueHealthReport, QueueHealthStatus } from "../core/types.js";
import {
  createConnection,
  createBullMQConnection,
  checkConnectionHealth,
  deriveHealthStatus,
} from "../core/connection.js";
import { getAllQueueNames } from "../definitions/queues.js";
import { getLogger } from "./logger.js";
import { Queue } from "bullmq";

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/**
 * Run a comprehensive health check across all known queues.
 *
 * @returns An array of health reports, one per queue.
 */
export async function runHealthCheck(config: QueueConfig): Promise<QueueHealthReport[]> {
  const logger = getLogger(config);
  const rawConnection = createConnection(config, "health-check");
  const redisHealth = await checkConnectionHealth(rawConnection);
  const connection = createBullMQConnection(config, "health-check");

  const queueNames = getAllQueueNames();
  const reports: QueueHealthReport[] = [];

  for (const queueName of queueNames) {
    try {
      const queue = new Queue(queueName, { connection });
      const counts = await queue.getJobCounts("waiting", "active", "completed", "failed", "delayed");

      const status = deriveHealthStatus(redisHealth.connected, counts.failed ?? 0, counts.delayed ?? 0);

      reports.push({
        queueName,
        status,
        redis: redisHealth,
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
        timestamp: new Date().toISOString(),
      });

      await queue.close();
    } catch (err) {
      logger.error(`Health check failed for queue ${queueName}`, {
        error: err instanceof Error ? err.message : String(err),
      });

      reports.push({
        queueName,
        status: "unhealthy",
        redis: { connected: false, latencyMs: null },
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return reports;
}

/**
 * Get a single aggregated health status across all queues.
 */
export function aggregateHealthStatus(reports: QueueHealthReport[]): QueueHealthStatus {
  if (reports.length === 0) return "unhealthy";

  if (reports.some((r) => r.status === "unhealthy")) return "unhealthy";
  if (reports.some((r) => r.status === "degraded")) return "degraded";
  return "healthy";
}
