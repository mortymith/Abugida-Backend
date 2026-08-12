/**
 * @module core/types
 * @description Core type definitions for the Abugida queue system.
 * Provides discriminated-union error types, job interfaces, processor
 * contracts, and queue configuration types used across the entire package.
 */

import type { Processor } from "bullmq";

// ---------------------------------------------------------------------------
// Job Types
// ---------------------------------------------------------------------------

/**
 * Enum of every job type the Abugida queue system recognises.
 * Each value maps to a named queue and a registered processor function.
 */
export enum JobType {
  // Purchase (FR-400, FR-500)
  PURCHASE_INITIATE = "PURCHASE_INITIATE",
  PURCHASE_COMPLETE = "PURCHASE_COMPLETE",

  // Enrollment (FR-500)
  BUNDLE_ENROLLMENT_CREATE = "BUNDLE_ENROLLMENT_CREATE",
  ENROLLMENT_PROGRESS_UPDATE = "ENROLLMENT_PROGRESS_UPDATE",

  // Lesson & Quiz (FR-500)
  LESSON_COMPLETION_UPDATE = "LESSON_COMPLETION_UPDATE",
  QUIZ_GRADE = "QUIZ_GRADE",

  // Export (FR-904)
  DATA_EXPORT = "DATA_EXPORT",

  // Webhook (FR-400, FR-1000)
  WEBHOOK_PROCESS = "WEBHOOK_PROCESS",

  // Notification
  SMS_NOTIFICATION = "SMS_NOTIFICATION",
  EMAIL_NOTIFICATION = "EMAIL_NOTIFICATION",

  // Moderation
  MODERATION_SUBMIT = "MODERATION_SUBMIT",

  // Statistics
  RECALCULATE_STATS = "RECALCULATE_STATS",
  AGGREGATE_METRICS = "AGGREGATE_METRICS",

  // Audit & Maintenance
  AUDIT_LOG = "AUDIT_LOG",
  MAINTENANCE_TASK = "MAINTENANCE_TASK",
  DATA_RETENTION = "DATA_RETENTION",
}

// ---------------------------------------------------------------------------
// Job Data Interfaces
// ---------------------------------------------------------------------------

/** Payload for PURCHASE_INITIATE jobs */
export interface PurchaseInitiateJobData {
  userId: string;
  courseId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  idempotencyKey: string;
}

/** Payload for PURCHASE_COMPLETE jobs (Telebirr callback) */
export interface PurchaseCompleteJobData {
  purchaseId: string;
  transactionId: string;
  status: "success" | "failed" | "pending";
  callbackPayload: Record<string, unknown>;
  idempotencyKey: string;
}

/** Payload for BUNDLE_ENROLLMENT_CREATE jobs */
export interface BundleEnrollmentCreateJobData {
  userId: string;
  bundleId: string;
  courseIds: string[];
  idempotencyKey: string;
}

/** Payload for ENROLLMENT_PROGRESS_UPDATE jobs */
export interface EnrollmentProgressUpdateJobData {
  enrollmentId: string;
  lessonId?: string;
  completedLessons: number;
  totalLessons: number;
  idempotencyKey: string;
}

/** Payload for LESSON_COMPLETION_UPDATE jobs */
export interface LessonCompletionUpdateJobData {
  enrollmentId: string;
  lessonId: string;
  completed: boolean;
  idempotencyKey: string;
}

/** Payload for QUIZ_GRADE jobs */
export interface QuizGradeJobData {
  enrollmentId: string;
  quizId: string;
  submissionId: string;
  answers: Record<string, string | number | boolean>;
  idempotencyKey: string;
}

/** Payload for DATA_EXPORT jobs (GDPR) */
export interface DataExportJobData {
  userId: string;
  format: "json" | "csv";
  requestedAt: string; // ISO-8601
  idempotencyKey: string;
}

/** Payload for WEBHOOK_PROCESS jobs */
export interface WebhookProcessJobData {
  source: "telebirr" | "sms_ethiopia" | "other";
  payload: Record<string, unknown>;
  headers: Record<string, string>;
  idempotencyKey: string;
}

/** Payload for SMS_NOTIFICATION jobs */
export interface SmsNotificationJobData {
  recipientPhone: string;
  message: string;
  templateId?: string;
  idempotencyKey: string;
}

/** Payload for EMAIL_NOTIFICATION jobs */
export interface EmailNotificationJobData {
  recipientEmail: string;
  subject: string;
  htmlBody: string;
  templateId?: string;
  idempotencyKey: string;
}

/** Payload for MODERATION_SUBMIT jobs */
export interface ModerationSubmitJobData {
  entityType: "review" | "comment" | "resource";
  entityId: string;
  content: string;
  submittedBy: string;
  idempotencyKey: string;
}

/** Payload for RECALCULATE_STATS jobs */
export interface RecalculateStatsJobData {
  courseId: string;
  idempotencyKey: string;
}

/** Payload for AGGREGATE_METRICS jobs */
export interface AggregateMetricsJobData {
  period: "daily" | "weekly" | "monthly";
  date: string; // ISO-8601
  idempotencyKey: string;
}

/** Payload for AUDIT_LOG jobs */
export interface AuditLogJobData {
  action: string;
  actorId: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  idempotencyKey: string;
}

/** Payload for MAINTENANCE_TASK jobs */
export interface MaintenanceTaskJobData {
  taskName: string;
  params: Record<string, unknown>;
  idempotencyKey: string;
}

/** Payload for DATA_RETENTION jobs */
export interface DataRetentionJobData {
  entityType: "audit_log" | "session" | "temp_export";
  olderThanDays: number;
  batchSize: number;
  idempotencyKey: string;
}

/**
 * Discriminated union of all job data payloads.
 * The discriminator is the `jobType` field matching {@link JobType}.
 */
export type JobDataMap = {
  [JobType.PURCHASE_INITIATE]: PurchaseInitiateJobData;
  [JobType.PURCHASE_COMPLETE]: PurchaseCompleteJobData;
  [JobType.BUNDLE_ENROLLMENT_CREATE]: BundleEnrollmentCreateJobData;
  [JobType.ENROLLMENT_PROGRESS_UPDATE]: EnrollmentProgressUpdateJobData;
  [JobType.LESSON_COMPLETION_UPDATE]: LessonCompletionUpdateJobData;
  [JobType.QUIZ_GRADE]: QuizGradeJobData;
  [JobType.DATA_EXPORT]: DataExportJobData;
  [JobType.WEBHOOK_PROCESS]: WebhookProcessJobData;
  [JobType.SMS_NOTIFICATION]: SmsNotificationJobData;
  [JobType.EMAIL_NOTIFICATION]: EmailNotificationJobData;
  [JobType.MODERATION_SUBMIT]: ModerationSubmitJobData;
  [JobType.RECALCULATE_STATS]: RecalculateStatsJobData;
  [JobType.AGGREGATE_METRICS]: AggregateMetricsJobData;
  [JobType.AUDIT_LOG]: AuditLogJobData;
  [JobType.MAINTENANCE_TASK]: MaintenanceTaskJobData;
  [JobType.DATA_RETENTION]: DataRetentionJobData;
};

// ---------------------------------------------------------------------------
// Processor Types
// ---------------------------------------------------------------------------

/**
 * A typed job processor function.
 * Receives the job data and must return a result or void.
 */
export type JobProcessor<T = unknown> = (
  data: T,
  job: { id: string; name: string; attemptsMade: number; timestamp: number }
) => Promise<unknown>;

/**
 * Registry entry mapping a {@link JobType} to its processor implementation.
 */
export interface ProcessorEntry<T = unknown> {
  jobType: JobType;
  processor: JobProcessor<T>;
  queueName: string;
  concurrency: number;
  priority?: number;
}

/**
 * Union of every typed processor entry, keyed by {@link JobType}.
 * Use this when aggregating heterogeneous processor entries (e.g. the
 * worker registry), since a bare {@link ProcessorEntry} defaults to
 * `JobProcessor<unknown>` which typed processors are not assignable to.
 */
export type AnyProcessorEntry = {
  [T in JobType]: ProcessorEntry<JobDataMap[T]>;
}[JobType];

/**
 * Function that builds a BullMQ-compatible Processor from a typed processor.
 */
export type ProcessorAdapter = Processor;

// ---------------------------------------------------------------------------
// Queue Client & Worker
// ---------------------------------------------------------------------------

/**
 * The queue client (producer) – enqueues jobs and inspects queue state.
 */
export interface QueueClient {
  /** Enqueue a single job. Returns the job ID. */
  enqueue<T extends JobType>(jobType: T, data: JobDataMap[T], opts?: EnqueueOptions): Promise<string>;

  /** Enqueue a bulk set of jobs. Returns an array of job IDs. */
  enqueueBulk<T extends JobType>(
    items: Array<{ jobType: T; data: JobDataMap[T]; opts?: EnqueueOptions }>
  ): Promise<string[]>;

  /** Get current queue length (waiting + active + delayed). */
  getQueueLength(queueName: string): Promise<number>;

  /** Get job counts grouped by state. */
  getJobCounts(queueName: string): Promise<Record<string, number>>;

  /** Gracefully close all queue connections. */
  close(): Promise<void>;
}

/** Options that can be passed when enqueuing a job. */
export interface EnqueueOptions {
  priority?: number;
  delay?: number;
  jobId?: string;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
  backoff?: {
    type: "fixed" | "exponential";
    delay: number;
  };
}

/**
 * The queue worker (consumer) – processes jobs from one or more queues.
 */
export interface QueueWorker {
  /** Start processing jobs. Resolves when the worker is ready. */
  start(): Promise<void>;

  /** Gracefully stop the worker. Waits for in-flight jobs to finish. */
  stop(): Promise<void>;

  /** Check whether the worker is currently running. */
  isRunning(): boolean;

  /** Register a custom processor at runtime (before start). */
  registerProcessor(entry: AnyProcessorEntry): void;
}

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

/** Base error for all queue-related failures. */
export class QueueError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "QueueError";
  }
}

/** A job failed after all retry attempts. */
export class JobExhaustedError extends QueueError {
  constructor(
    public readonly jobType: JobType,
    public readonly jobId: string,
    public readonly attemptsMade: number,
    public readonly lastError: Error
  ) {
    super(`Job ${jobType}#${jobId} exhausted after ${attemptsMade} attempts`, "JOB_EXHAUSTED", lastError);
    this.name = "JobExhaustedError";
  }
}

/** The job was rejected because the idempotency key was already processed. */
export class DuplicateJobError extends QueueError {
  constructor(
    public readonly idempotencyKey: string,
    public readonly jobType: JobType
  ) {
    super(`Duplicate job rejected: ${jobType} with key ${idempotencyKey}`, "DUPLICATE_JOB");
    this.name = "DuplicateJobError";
  }
}

/** Redis connection is unavailable or unhealthy. */
export class RedisConnectionError extends QueueError {
  constructor(
    public readonly endpoint: string,
    cause?: unknown
  ) {
    super(`Redis connection error for ${endpoint}`, "REDIS_CONNECTION", cause);
    this.name = "RedisConnectionError";
  }
}

/** Job data failed validation. */
export class JobValidationError extends QueueError {
  constructor(
    public readonly jobType: JobType,
    public readonly errors: string[]
  ) {
    super(`Job validation failed for ${jobType}: ${errors.join(", ")}`, "JOB_VALIDATION");
    this.name = "JobValidationError";
  }
}

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

export interface IdempotencyRecord {
  id: string;
  jobType: JobType;
  processedAt: Date;
  result: unknown;
  status: "processing" | "completed" | "failed";
}

// ---------------------------------------------------------------------------
// Health & Monitoring
// ---------------------------------------------------------------------------

export type QueueHealthStatus = "healthy" | "degraded" | "unhealthy";

export interface QueueHealthReport {
  queueName: string;
  status: QueueHealthStatus;
  redis: { connected: boolean; latencyMs: number | null };
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  timestamp: string;
}

export interface WorkerHealthReport {
  workerId: string;
  status: "running" | "stopped" | "error";
  queues: string[];
  uptime: number;
  processedJobs: number;
  failedJobs: number;
  timestamp: string;
}

export interface MetricsSnapshot {
  totalEnqueued: number;
  totalCompleted: number;
  totalFailed: number;
  avgProcessingTimeMs: number;
  queues: Record<
    string,
    {
      enqueued: number;
      completed: number;
      failed: number;
      avgTimeMs: number;
    }
  >;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * The main entry-point factory that creates the queue client and worker
 * from a validated {@link QueueConfig}.
 */
export interface QueueFactory {
  /** Create a producer client. */
  createClient(): QueueClient;
  /** Create a consumer worker. */
  createWorker(processors?: AnyProcessorEntry[]): QueueWorker;
  /** Run an ad-hoc health check. */
  healthCheck(): Promise<QueueHealthReport[]>;
  /** Capture a metrics snapshot. */
  getMetrics(): Promise<MetricsSnapshot>;
  /** Gracefully tear down everything. */
  shutdown(): Promise<void>;
}
