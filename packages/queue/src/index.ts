/**
 * @module index
 * @description Public entry point of `@abugida/queue`.
 *
 * The package owns the **job contract** and the **producer runtime**:
 *
 * - the job types, their payloads and the error hierarchy (the contract),
 * - `createQueueClient` for enqueuing jobs (the producer),
 * - the Redis connection helpers and the configuration vocabulary,
 * - the payload validators, and
 * - the Hono and TanStack Start *producer* adapters.
 *
 * The **consumer runtime** — the BullMQ worker, the processors, the registry
 * and the Telebirr/SMSEthiopia integrations — lives in `app/worker`
 * (ADR-028). Nothing here re-exports it.
 */

// ---------------------------------------------------------------------------
// Job Contract
// ---------------------------------------------------------------------------

export {
  JobType,
  QueueError,
  JobExhaustedError,
  DuplicateJobError,
  RedisConnectionError,
  JobValidationError,
  type QueueClient,
  type EnqueueOptions,
  type JobDataMap,
  // Job data interfaces
  type PurchaseInitiateJobData,
  type PurchaseCompleteJobData,
  type BundleEnrollmentCreateJobData,
  type EnrollmentProgressUpdateJobData,
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
} from './core/types.js'

// ---------------------------------------------------------------------------
// Producer Runtime
// ---------------------------------------------------------------------------

export { createQueueClient } from './core/client.js'

export {
  createConnection,
  createBullMQConnection,
  closeConnection,
  closeAllConnections,
} from './core/connection.js'

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
} from './definitions/queues.js'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type {
  QueueConfig,
  RedisConfig,
  QueueSpecificConfig,
  LoggingConfig,
} from './config/schema.js'
export {
  getDefaultConfig,
  mergeWithDefaults,
  REDIS_DEFAULTS,
  LOGGING_DEFAULTS,
} from './config/defaults.js'

// ---------------------------------------------------------------------------
// Payload Validation
// ---------------------------------------------------------------------------

export { validateJobData, assertJobData, type ValidationResult } from './utils/validators.js'

// ---------------------------------------------------------------------------
// Framework Producer Adapters
// ---------------------------------------------------------------------------

export {
  createHonoQueueClient,
  createQueueMiddleware,
  type HonoQueueContext,
} from './middleware/hono/client.js'

export {
  getTanStackQueueClient,
  closeTanStackQueueClient,
  createTanStackQueueClient,
} from './middleware/tanstack/client.js'
