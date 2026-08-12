/**
 * @module definitions/queues
 * @description Central registry of queue names, default concurrency values,
 * priority levels, and per-queue job options.  Every queue used by the
 * Abugida platform must be declared here.
 */

import { JobType } from "../core/types.js";
import type { QueueConfig } from "../config/schema.js";

// ---------------------------------------------------------------------------
// Queue Names
// ---------------------------------------------------------------------------

export const QUEUE_NAMES = {
  /** High-priority: purchases, quiz grading */
  PURCHASES: "abugida.purchases",
  ENROLLMENTS: "abugida.enrollments",
  LESSONS: "abugida.lessons",
  QUIZZES: "abugida.quizzes",
  /** Medium-priority: notifications, exports, webhooks */
  NOTIFICATIONS: "abugida.notifications",
  EXPORTS: "abugida.exports",
  WEBHOOKS: "abugida.webhooks",
  MODERATION: "abugida.moderation",
  /** Low-priority: statistics, maintenance, audit */
  STATISTICS: "abugida.statistics",
  AUDIT: "abugida.audit",
  MAINTENANCE: "abugida.maintenance",
} as const;

// ---------------------------------------------------------------------------
// Job → Queue Mapping
// ---------------------------------------------------------------------------

/**
 * Maps each {@link JobType} to its owning queue name.
 */
export const JOB_QUEUE_MAP: Record<JobType, string> = {
  [JobType.PURCHASE_INITIATE]: QUEUE_NAMES.PURCHASES,
  [JobType.PURCHASE_COMPLETE]: QUEUE_NAMES.PURCHASES,
  [JobType.BUNDLE_ENROLLMENT_CREATE]: QUEUE_NAMES.ENROLLMENTS,
  [JobType.ENROLLMENT_PROGRESS_UPDATE]: QUEUE_NAMES.ENROLLMENTS,
  [JobType.LESSON_COMPLETION_UPDATE]: QUEUE_NAMES.LESSONS,
  [JobType.QUIZ_GRADE]: QUEUE_NAMES.QUIZZES,
  [JobType.DATA_EXPORT]: QUEUE_NAMES.EXPORTS,
  [JobType.WEBHOOK_PROCESS]: QUEUE_NAMES.WEBHOOKS,
  [JobType.SMS_NOTIFICATION]: QUEUE_NAMES.NOTIFICATIONS,
  [JobType.EMAIL_NOTIFICATION]: QUEUE_NAMES.NOTIFICATIONS,
  [JobType.MODERATION_SUBMIT]: QUEUE_NAMES.MODERATION,
  [JobType.RECALCULATE_STATS]: QUEUE_NAMES.STATISTICS,
  [JobType.AGGREGATE_METRICS]: QUEUE_NAMES.STATISTICS,
  [JobType.AUDIT_LOG]: QUEUE_NAMES.AUDIT,
  [JobType.MAINTENANCE_TASK]: QUEUE_NAMES.MAINTENANCE,
  [JobType.DATA_RETENTION]: QUEUE_NAMES.MAINTENANCE,
};

// ---------------------------------------------------------------------------
// Default Queue Options
// ---------------------------------------------------------------------------

/**
 * Default BullMQ queue options per queue.  These can be overridden via
 * {@link QueueConfig.queues}.
 */
export const DEFAULT_QUEUE_OPTIONS: Record<string, QueueConfig["queues"][string]> = {
  [QUEUE_NAMES.PURCHASES]: {
    concurrency: 5,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 500,
    },
  },
  [QUEUE_NAMES.ENROLLMENTS]: {
    concurrency: 3,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 1000,
      removeOnFail: 200,
    },
  },
  [QUEUE_NAMES.LESSONS]: {
    concurrency: 5,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 2000,
      removeOnFail: 200,
    },
  },
  [QUEUE_NAMES.QUIZZES]: {
    concurrency: 10,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 2000,
      removeOnFail: 200,
    },
  },
  [QUEUE_NAMES.NOTIFICATIONS]: {
    concurrency: 10,
    limiter: { max: 100, duration: 60_000 }, // 100/min
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 5000,
      removeOnFail: 1000,
    },
  },
  [QUEUE_NAMES.EXPORTS]: {
    concurrency: 2,
    defaultJobOptions: {
      attempts: 2,
      timeout: 300_000, // 5 min for large exports
      backoff: { type: "fixed", delay: 30_000 },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  },
  [QUEUE_NAMES.WEBHOOKS]: {
    concurrency: 5,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 5000,
      removeOnFail: 1000,
    },
  },
  [QUEUE_NAMES.MODERATION]: {
    concurrency: 3,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "fixed", delay: 5000 },
      removeOnComplete: 2000,
      removeOnFail: 500,
    },
  },
  [QUEUE_NAMES.STATISTICS]: {
    concurrency: 1,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "fixed", delay: 10_000 },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  },
  [QUEUE_NAMES.AUDIT]: {
    concurrency: 5,
    limiter: { max: 500, duration: 60_000 },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 10_000,
      removeOnFail: 2000,
    },
  },
  [QUEUE_NAMES.MAINTENANCE]: {
    concurrency: 1,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "fixed", delay: 30_000 },
      removeOnComplete: true,
      removeOnFail: 50,
    },
  },
};

// ---------------------------------------------------------------------------
// Priority Levels
// ---------------------------------------------------------------------------

/**
 * Priority constants.  Lower number = higher priority in BullMQ.
 */
export const PRIORITY = {
  HIGH: 1,
  MEDIUM: 5,
  LOW: 10,
} as const;

/**
 * Maps job types to their default priority.
 */
export const JOB_PRIORITY_MAP: Partial<Record<JobType, number>> = {
  [JobType.QUIZ_GRADE]: PRIORITY.HIGH,
  [JobType.PURCHASE_INITIATE]: PRIORITY.HIGH,
  [JobType.PURCHASE_COMPLETE]: PRIORITY.HIGH,
  [JobType.SMS_NOTIFICATION]: PRIORITY.MEDIUM,
  [JobType.EMAIL_NOTIFICATION]: PRIORITY.MEDIUM,
  [JobType.DATA_EXPORT]: PRIORITY.MEDIUM,
  [JobType.WEBHOOK_PROCESS]: PRIORITY.MEDIUM,
  [JobType.MODERATION_SUBMIT]: PRIORITY.MEDIUM,
  [JobType.RECALCULATE_STATS]: PRIORITY.LOW,
  [JobType.AGGREGATE_METRICS]: PRIORITY.LOW,
  [JobType.AUDIT_LOG]: PRIORITY.LOW,
  [JobType.MAINTENANCE_TASK]: PRIORITY.LOW,
  [JobType.DATA_RETENTION]: PRIORITY.LOW,
};

// ---------------------------------------------------------------------------
// All Queue Names helper
// ---------------------------------------------------------------------------

/** Returns all declared queue names. */
export function getAllQueueNames(): string[] {
  return Object.values(QUEUE_NAMES);
}
