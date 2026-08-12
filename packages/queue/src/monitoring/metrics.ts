/**
 * @module monitoring/metrics
 * @description Metrics collection and aggregation for queue observability.
 * Tracks throughput, success/failure rates, and processing times.
 */

import type { RedisClient } from "bun";
import type { QueueConfig } from "../config/schema.js";
import type { MetricsSnapshot } from "../core/types.js";
import { createBullMQConnection } from "../core/connection.js";
import { getAllQueueNames } from "../definitions/queues.js";
import { getLogger } from "./logger.js";
import { Queue } from "bullmq";

// ---------------------------------------------------------------------------
// Metrics Key Helpers
// ---------------------------------------------------------------------------

const METRICS_PREFIX = "abugida:queue:metrics";

function metricsKey(queueName: string, metric: string): string {
  return `${METRICS_PREFIX}:${queueName}:${metric}`;
}

// ---------------------------------------------------------------------------
// Metrics Collection
// ---------------------------------------------------------------------------

/**
 * Capture a point-in-time metrics snapshot across all known queues.
 */
export async function captureMetrics(config: QueueConfig): Promise<MetricsSnapshot> {
  const logger = getLogger(config);
  const connection = createBullMQConnection(config, "metrics");
  const queueNames = getAllQueueNames();

  let totalEnqueued = 0;
  let totalCompleted = 0;
  let totalFailed = 0;
  const totalTime = 0;
  const totalProcessed = 0;
  const queueMetrics: MetricsSnapshot["queues"] = {};

  for (const queueName of queueNames) {
    try {
      const queue = new Queue(queueName, { connection });
      const counts = await queue.getJobCounts("waiting", "active", "completed", "failed", "delayed");

      // Use completed + failed as proxy for total processed
      const enqueued = (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);
      const completed = counts.completed ?? 0;
      const failed = counts.failed ?? 0;

      totalEnqueued += enqueued;
      totalCompleted += completed;
      totalFailed += failed;

      // Note: Real processing time would require instrumentation inside
      // processors. Here we return 0 as a placeholder.
      const avgTimeMs = 0;
      queueMetrics[queueName] = {
        enqueued,
        completed,
        failed,
        avgTimeMs,
      };

      await queue.close();
    } catch (err) {
      logger.error(`Metrics collection failed for queue ${queueName}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    totalEnqueued,
    totalCompleted,
    totalFailed,
    avgProcessingTimeMs: totalProcessed > 0 ? Math.round(totalTime / totalProcessed) : 0,
    queues: queueMetrics,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Increment a counter metric in Redis.
 */
export async function incrementCounter(
  connection: RedisClient,
  queueName: string,
  metric: string,
  amount: number = 1
): Promise<void> {
  const key = metricsKey(queueName, metric);
  await connection.incrby(key, amount);
}

/**
 * Record a timing metric (average) in Redis.
 */
export async function recordTiming(
  connection: RedisClient,
  queueName: string,
  metric: string,
  durationMs: number
): Promise<void> {
  const key = metricsKey(queueName, metric);
  // Simple approach: store latest value. For real production, use
  // a time-windowed rolling average.
  await connection.set(key, String(durationMs), "EX", 300);
}
