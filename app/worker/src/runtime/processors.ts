/**
 * @module runtime/processors
 * @description The worker app's processor registry.
 *
 * One entry per job type, keyed by the job type itself. The registry is the
 * single place where "which processor handles which job type, on which queue"
 * is declared, and it is type-checked against the shared contract:
 *
 * - a job type without an entry is a compile error,
 * - a `queueName` that disagrees with `JOB_QUEUE_MAP` is a compile error,
 * - a processor that receives the wrong payload type is a compile error.
 *
 * Adding a `JobType` to `@abugida/queue` therefore breaks this file's
 * typecheck until the new job type is handled here (ADR-028 §5.2).
 */

import { JobType, QUEUE_NAMES } from '@abugida/queue'

import { processAuditLog } from '@/processors/audit'
import { processBundleEnrollmentCreate } from '@/processors/enrollment'
import { processEnrollmentProgressUpdate } from '@/processors/enrollment'
import { processDataExport } from '@/processors/export'
import { processMaintenanceTask } from '@/processors/maintenance'
import { processDataRetention } from '@/processors/maintenance'
import { processModerationSubmit } from '@/processors/moderation'
import { processEmailNotification } from '@/processors/notification'
import { processSmsNotification } from '@/processors/notification'
import { processAggregateMetrics } from '@/processors/statistics'
import { processRecalculateStats } from '@/processors/statistics'
import { processPurchaseComplete } from '@/processors/purchase'
import { processPurchaseInitiate } from '@/processors/purchase'
import { processWebhook } from '@/processors/webhook'

import type { AnyProcessorEntry, ProcessorEntries } from './types'

/**
 * Every job type and the processor that handles it.
 *
 * The `satisfies` clause is the contract-drift guard: it fails to compile
 * when the shared contract and this registry disagree.
 */
export const processors = {
  // Purchases — Telebirr H5 C2B payment gateway.
  [JobType.PURCHASE_INITIATE]: {
    jobType: JobType.PURCHASE_INITIATE,
    processor: processPurchaseInitiate,
    queueName: QUEUE_NAMES.PURCHASES,
  },
  [JobType.PURCHASE_COMPLETE]: {
    jobType: JobType.PURCHASE_COMPLETE,
    processor: processPurchaseComplete,
    queueName: QUEUE_NAMES.PURCHASES,
  },

  // Enrollments.
  [JobType.BUNDLE_ENROLLMENT_CREATE]: {
    jobType: JobType.BUNDLE_ENROLLMENT_CREATE,
    processor: processBundleEnrollmentCreate,
    queueName: QUEUE_NAMES.ENROLLMENTS,
  },
  [JobType.ENROLLMENT_PROGRESS_UPDATE]: {
    jobType: JobType.ENROLLMENT_PROGRESS_UPDATE,
    processor: processEnrollmentProgressUpdate,
    queueName: QUEUE_NAMES.ENROLLMENTS,
  },

  // Exports.
  [JobType.DATA_EXPORT]: {
    jobType: JobType.DATA_EXPORT,
    processor: processDataExport,
    queueName: QUEUE_NAMES.EXPORTS,
  },

  // Webhooks.
  [JobType.WEBHOOK_PROCESS]: {
    jobType: JobType.WEBHOOK_PROCESS,
    processor: processWebhook,
    queueName: QUEUE_NAMES.WEBHOOKS,
  },

  // Notifications.
  [JobType.SMS_NOTIFICATION]: {
    jobType: JobType.SMS_NOTIFICATION,
    processor: processSmsNotification,
    queueName: QUEUE_NAMES.NOTIFICATIONS,
  },
  [JobType.EMAIL_NOTIFICATION]: {
    jobType: JobType.EMAIL_NOTIFICATION,
    processor: processEmailNotification,
    queueName: QUEUE_NAMES.NOTIFICATIONS,
  },

  // Moderation.
  [JobType.MODERATION_SUBMIT]: {
    jobType: JobType.MODERATION_SUBMIT,
    processor: processModerationSubmit,
    queueName: QUEUE_NAMES.MODERATION,
  },

  // Statistics.
  [JobType.RECALCULATE_STATS]: {
    jobType: JobType.RECALCULATE_STATS,
    processor: processRecalculateStats,
    queueName: QUEUE_NAMES.STATISTICS,
  },
  [JobType.AGGREGATE_METRICS]: {
    jobType: JobType.AGGREGATE_METRICS,
    processor: processAggregateMetrics,
    queueName: QUEUE_NAMES.STATISTICS,
  },

  // Audit.
  [JobType.AUDIT_LOG]: {
    jobType: JobType.AUDIT_LOG,
    processor: processAuditLog,
    queueName: QUEUE_NAMES.AUDIT,
  },

  // Maintenance.
  [JobType.MAINTENANCE_TASK]: {
    jobType: JobType.MAINTENANCE_TASK,
    processor: processMaintenanceTask,
    queueName: QUEUE_NAMES.MAINTENANCE,
  },
  [JobType.DATA_RETENTION]: {
    jobType: JobType.DATA_RETENTION,
    processor: processDataRetention,
    queueName: QUEUE_NAMES.MAINTENANCE,
  },
} satisfies ProcessorEntries

/**
 * Every registered entry, flattened.
 *
 * The worker runtime consumes this list; the per-queue grouping happens in
 * {@link ./registry.ts}.
 */
export const allProcessors: AnyProcessorEntry[] = Object.values(processors)
