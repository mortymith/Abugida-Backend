/**
 * @module index
 * @description Main entry point for `@abugida/queue`. Re-exports everything
 * needed for production usage: the factory function, types, processors,
 * and framework-specific middleware.
 */

// ---------------------------------------------------------------------------
// Core Types
// ---------------------------------------------------------------------------

export {
  JobType,
  QueueError,
  JobExhaustedError,
  DuplicateJobError,
  RedisConnectionError,
  JobValidationError,
  type QueueClient,
  type QueueWorker,
  type QueueFactory,
  type ProcessorEntry,
  type AnyProcessorEntry,
  type EnqueueOptions,
  type JobProcessor,
  type QueueHealthReport,
  type QueueHealthStatus,
  type MetricsSnapshot,
  type IdempotencyRecord,
  // Job data interfaces
  type PurchaseInitiateJobData,
  type PurchaseCompleteJobData,
  type BundleEnrollmentCreateJobData,
  type EnrollmentProgressUpdateJobData,
  type LessonCompletionUpdateJobData,
  type QuizGradeJobData,
  type DataExportJobData,
  type WebhookProcessJobData,
  type SmsNotificationJobData,
  type EmailNotificationJobData,
  type ModerationSubmitJobData,
  type RecalculateStatsJobData,
  type AggregateMetricsJobData,
  type AuditLogJobData,
  type MaintenanceTaskJobData,
  type DataRetentionJobData,
  type JobDataMap,
} from "./core/types.js";

// ---------------------------------------------------------------------------
// Core Implementation
// ---------------------------------------------------------------------------

export { createQueueClient } from "./core/client.js";
export { createQueueWorker } from "./core/worker.js";
export {
  createConnection,
  createBullMQConnection,
  closeConnection,
  closeAllConnections,
  checkConnectionHealth,
  deriveHealthStatus,
} from "./core/connection.js";

// ---------------------------------------------------------------------------
// Queue Definitions
// ---------------------------------------------------------------------------

export {
  QUEUE_NAMES,
  JOB_QUEUE_MAP,
  DEFAULT_QUEUE_OPTIONS,
  PRIORITY,
  JOB_PRIORITY_MAP,
  getAllQueueNames,
} from "./definitions/queues.js";

export { type TypedProcessors, ProcessorRegistry } from "./definitions/processors.js";

// ---------------------------------------------------------------------------
// Processors
// ---------------------------------------------------------------------------

export { allProcessors, getProcessorsForQueue, getProcessorForJobType } from "./processors/index.js";

// Re-export individual processor modules for selective imports
export { purchaseProcessors } from "./processors/purchase.js";
export { enrollmentProcessors } from "./processors/enrollment.js";
export { lessonProcessors } from "./processors/lesson.js";
export { exportProcessors } from "./processors/export.js";
export { webhookProcessors } from "./processors/webhook.js";
export { notificationProcessors } from "./processors/notification.js";
export { moderationProcessors } from "./processors/moderation.js";
export { statisticsProcessors } from "./processors/statistics.js";
export { auditProcessors } from "./processors/audit.js";
export { maintenanceProcessors } from "./processors/maintenance.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type {
  QueueConfig,
  RedisConfig,
  QueueSpecificConfig,
  MonitoringConfig,
  LoggingConfig,
} from "./config/schema.js";
export {
  getDefaultConfig,
  mergeWithDefaults,
  REDIS_DEFAULTS,
  MONITORING_DEFAULTS,
  LOGGING_DEFAULTS,
} from "./config/defaults.js";
export {
  detectEnvironment,
  isProduction,
  isDevelopment,
  getAppName,
  getWorkerId,
  requireEnv,
  envWithDefault,
  envNumber,
} from "./config/env.js";

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------

export { getLogger, type Logger } from "./monitoring/logger.js";
export { runHealthCheck, aggregateHealthStatus } from "./monitoring/health.js";
export { captureMetrics, incrementCounter, recordTiming } from "./monitoring/metrics.js";
export { generateDashboardHtml } from "./monitoring/dashboard.js";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export {
  processWithIdempotency,
  checkIdempotency,
  acquireProcessingLock,
  storeIdempotencyResult,
  markProcessingFailed,
} from "./utils/idempotency.js";

export {
  calculateBackoff,
  withRetry,
  withConditionalRetry,
  RetryPredicates,
  type RetryOptions,
} from "./utils/retry.js";

export { validateJobData, assertJobData, type ValidationResult } from "./utils/validators.js";

export { classifyError, safeErrorMessage } from "./utils/errors.js";

// ---------------------------------------------------------------------------
// Framework Middleware
// ---------------------------------------------------------------------------

export { createHonoQueueClient, createQueueMiddleware, type HonoQueueContext } from "./middleware/hono/client.js";

export { createHonoWorker, type HonoWorkerOptions } from "./middleware/hono/worker.js";

export {
  getTanStackQueueClient,
  closeTanStackQueueClient,
  createTanStackQueueClient,
} from "./middleware/tanstack/client.js";

export {
  createTanStackWorker,
  setupGracefulShutdown,
  type TanStackWorkerOptions,
} from "./middleware/tanstack/worker.js";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

import type { QueueConfig } from "./config/schema.js";
import { createQueueClient } from "./core/client.js";
import { createQueueWorker } from "./core/worker.js";
import type { AnyProcessorEntry } from "./core/types.js";
import { runHealthCheck } from "./monitoring/health.js";
import { captureMetrics } from "./monitoring/metrics.js";
import { closeAllConnections } from "./core/connection.js";

/**
 * Main factory: create the complete queue system (client + worker + monitoring).
 *
 * @param config - Validated queue configuration.
 * @returns A {@link QueueFactory} with all operations.
 *
 * @example
 * ```ts
 * import { createQueueSystem } from "@abugida/queue";
 * import { mergeWithDefaults } from "@abugida/queue";
 *
 * const config = mergeWithDefaults({
 *   redis: { hostname: "localhost", port: 6379 },
 * });
 *
 * const queueSystem = createQueueSystem(config);
 *
 * // Producer
 * const jobId = await queueSystem.createClient().enqueue("PURCHASE_INITIATE", { ... });
 *
 * // Consumer
 * const worker = queueSystem.createWorker(allProcessors);
 * await worker.start();
 *
 * // Health check
 * const health = await queueSystem.healthCheck();
 *
 * // Shutdown
 * await queueSystem.shutdown();
 * ```
 */
export function createQueueSystem(config: QueueConfig): import("./core/types.js").QueueFactory {
  return {
    createClient: () => createQueueClient(config),

    createWorker: (processors?: AnyProcessorEntry[]) => createQueueWorker(config, processors),

    healthCheck: () => runHealthCheck(config),

    getMetrics: () => captureMetrics(config),

    shutdown: async () => {
      await closeAllConnections();
    },
  };
}
