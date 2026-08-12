/**
 * @module definitions/processors
 * @description Processor function type signatures.  Each processor receives
 * strongly-typed job data and returns a result.  Processors are registered
 * via {@link ProcessorRegistry} and consumed by the worker factory.
 */

import type { AnyProcessorEntry, JobProcessor, JobType } from "../core/types.js";

/**
 * A mapping from each {@link JobType} to its typed processor function.
 * This ensures type-safe processor registration.
 */
export interface TypedProcessors {
  [JobType.PURCHASE_INITIATE]: JobProcessor<import("../core/types.js").PurchaseInitiateJobData>;
  [JobType.PURCHASE_COMPLETE]: JobProcessor<import("../core/types.js").PurchaseCompleteJobData>;
  [JobType.BUNDLE_ENROLLMENT_CREATE]: JobProcessor<import("../core/types.js").BundleEnrollmentCreateJobData>;
  [JobType.ENROLLMENT_PROGRESS_UPDATE]: JobProcessor<import("../core/types.js").EnrollmentProgressUpdateJobData>;
  [JobType.LESSON_COMPLETION_UPDATE]: JobProcessor<import("../core/types.js").LessonCompletionUpdateJobData>;
  [JobType.QUIZ_GRADE]: JobProcessor<import("../core/types.js").QuizGradeJobData>;
  [JobType.DATA_EXPORT]: JobProcessor<import("../core/types.js").DataExportJobData>;
  [JobType.WEBHOOK_PROCESS]: JobProcessor<import("../core/types.js").WebhookProcessJobData>;
  [JobType.SMS_NOTIFICATION]: JobProcessor<import("../core/types.js").SmsNotificationJobData>;
  [JobType.EMAIL_NOTIFICATION]: JobProcessor<import("../core/types.js").EmailNotificationJobData>;
  [JobType.MODERATION_SUBMIT]: JobProcessor<import("../core/types.js").ModerationSubmitJobData>;
  [JobType.RECALCULATE_STATS]: JobProcessor<import("../core/types.js").RecalculateStatsJobData>;
  [JobType.AGGREGATE_METRICS]: JobProcessor<import("../core/types.js").AggregateMetricsJobData>;
  [JobType.AUDIT_LOG]: JobProcessor<import("../core/types.js").AuditLogJobData>;
  [JobType.MAINTENANCE_TASK]: JobProcessor<import("../core/types.js").MaintenanceTaskJobData>;
  [JobType.DATA_RETENTION]: JobProcessor<import("../core/types.js").DataRetentionJobData>;
}

/**
 * Registry that collects all processors and can look them up by job type.
 */
export class ProcessorRegistry {
  private readonly entries = new Map<JobType, AnyProcessorEntry>();

  /** Register a single processor entry. */
  register(entry: AnyProcessorEntry): void {
    this.entries.set(entry.jobType, entry);
  }

  /** Register multiple processor entries at once. */
  registerAll(entries: AnyProcessorEntry[]): void {
    for (const entry of entries) {
      this.register(entry);
    }
  }

  /** Get a processor entry by job type, or undefined if not registered. */
  get(jobType: JobType): AnyProcessorEntry | undefined {
    return this.entries.get(jobType);
  }

  /** Get all registered entries. */
  getAll(): AnyProcessorEntry[] {
    return Array.from(this.entries.values());
  }

  /** Check if a processor is registered for the given job type. */
  has(jobType: JobType): boolean {
    return this.entries.has(jobType);
  }

  /** Get all registered job types. */
  getJobTypes(): JobType[] {
    return Array.from(this.entries.keys());
  }

  /** Group entries by queue name (useful for worker setup). */
  getByQueue(): Map<string, AnyProcessorEntry[]> {
    const map = new Map<string, AnyProcessorEntry[]>();
    for (const entry of this.entries.values()) {
      const existing = map.get(entry.queueName) ?? [];
      existing.push(entry);
      map.set(entry.queueName, existing);
    }
    return map;
  }
}
