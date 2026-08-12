/**
 * @module utils/validators
 * @description Runtime validation for job data payloads. Validates required
 * fields, types, and formats before processing. Uses simple type-safe
 * validators instead of an external schema library.
 */

import type { JobDataMap, JobType } from "../core/types.js";
import { JobValidationError } from "../core/types.js";

// ---------------------------------------------------------------------------
// Validation Result
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Field Validators
// ---------------------------------------------------------------------------

function requiredString(value: unknown, field: string): string[] {
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    return [`${field} is required and must be a non-empty string`];
  }
  return [];
}

function requiredNumber(value: unknown, field: string): string[] {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return [`${field} is required and must be a valid number`];
  }
  return [];
}

function requiredObject(value: unknown, field: string): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [`${field} is required and must be an object`];
  }
  return [];
}

function requiredArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [`${field} is required and must be a non-empty array`];
  }
  return [];
}

function enumValue<T extends string>(value: unknown, field: string, allowed: T[]): string[] {
  if (!allowed.includes(value as T)) {
    return [`${field} must be one of: ${allowed.join(", ")}`];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Job-specific Validators
// ---------------------------------------------------------------------------

type ValidatorFn = (data: unknown) => string[];

const validators: Record<JobType, ValidatorFn> = {
  PURCHASE_INITIATE: (data) => {
    const d = data as import("../core/types.js").PurchaseInitiateJobData;
    return [
      ...requiredString(d?.userId, "userId"),
      ...requiredString(d?.courseId, "courseId"),
      ...requiredNumber(d?.amount, "amount"),
      ...requiredString(d?.currency, "currency"),
      ...requiredString(d?.paymentMethod, "paymentMethod"),
      ...requiredString(d?.idempotencyKey, "idempotencyKey"),
    ];
  },

  PURCHASE_COMPLETE: (data) => {
    const d = data as import("../core/types.js").PurchaseCompleteJobData;
    return [
      ...requiredString(d?.purchaseId, "purchaseId"),
      ...requiredString(d?.transactionId, "transactionId"),
      ...enumValue(d?.status, "status", ["success", "failed", "pending"]),
      ...requiredString(d?.idempotencyKey, "idempotencyKey"),
    ];
  },

  BUNDLE_ENROLLMENT_CREATE: (data) => {
    const d = data as import("../core/types.js").BundleEnrollmentCreateJobData;
    return [
      ...requiredString(d?.userId, "userId"),
      ...requiredString(d?.bundleId, "bundleId"),
      ...requiredArray(d?.courseIds, "courseIds"),
      ...requiredString(d?.idempotencyKey, "idempotencyKey"),
    ];
  },

  ENROLLMENT_PROGRESS_UPDATE: (data) => {
    const d = data as import("../core/types.js").EnrollmentProgressUpdateJobData;
    return [
      ...requiredString(d?.enrollmentId, "enrollmentId"),
      ...requiredNumber(d?.completedLessons, "completedLessons"),
      ...requiredNumber(d?.totalLessons, "totalLessons"),
      ...requiredString(d?.idempotencyKey, "idempotencyKey"),
    ];
  },

  LESSON_COMPLETION_UPDATE: (data) => {
    const d = data as import("../core/types.js").LessonCompletionUpdateJobData;
    return [
      ...requiredString(d?.enrollmentId, "enrollmentId"),
      ...requiredString(d?.lessonId, "lessonId"),
      ...requiredString(d?.idempotencyKey, "idempotencyKey"),
    ];
  },

  QUIZ_GRADE: (data) => {
    const d = data as import("../core/types.js").QuizGradeJobData;
    return [
      ...requiredString(d?.enrollmentId, "enrollmentId"),
      ...requiredString(d?.quizId, "quizId"),
      ...requiredString(d?.submissionId, "submissionId"),
      ...requiredObject(d?.answers, "answers"),
      ...requiredString(d?.idempotencyKey, "idempotencyKey"),
    ];
  },

  DATA_EXPORT: (data) => {
    const d = data as import("../core/types.js").DataExportJobData;
    return [
      ...requiredString(d?.userId, "userId"),
      ...enumValue(d?.format, "format", ["json", "csv"]),
      ...requiredString(d?.requestedAt, "requestedAt"),
      ...requiredString(d?.idempotencyKey, "idempotencyKey"),
    ];
  },

  WEBHOOK_PROCESS: (data) => {
    const d = data as import("../core/types.js").WebhookProcessJobData;
    return [
      ...enumValue(d?.source, "source", ["telebirr", "sms_ethiopia", "other"]),
      ...requiredObject(d?.payload, "payload"),
      ...requiredObject(d?.headers, "headers"),
      ...requiredString(d?.idempotencyKey, "idempotencyKey"),
    ];
  },

  SMS_NOTIFICATION: (data) => {
    const d = data as import("../core/types.js").SmsNotificationJobData;
    return [
      ...requiredString(d?.recipientPhone, "recipientPhone"),
      ...requiredString(d?.message, "message"),
      ...requiredString(d?.idempotencyKey, "idempotencyKey"),
    ];
  },

  EMAIL_NOTIFICATION: (data) => {
    const d = data as import("../core/types.js").EmailNotificationJobData;
    return [
      ...requiredString(d?.recipientEmail, "recipientEmail"),
      ...requiredString(d?.subject, "subject"),
      ...requiredString(d?.htmlBody, "htmlBody"),
      ...requiredString(d?.idempotencyKey, "idempotencyKey"),
    ];
  },

  MODERATION_SUBMIT: (data) => {
    const d = data as import("../core/types.js").ModerationSubmitJobData;
    return [
      ...enumValue(d?.entityType, "entityType", ["review", "comment", "resource"]),
      ...requiredString(d?.entityId, "entityId"),
      ...requiredString(d?.content, "content"),
      ...requiredString(d?.submittedBy, "submittedBy"),
      ...requiredString(d?.idempotencyKey, "idempotencyKey"),
    ];
  },

  RECALCULATE_STATS: (data) => {
    const d = data as import("../core/types.js").RecalculateStatsJobData;
    return [...requiredString(d?.courseId, "courseId"), ...requiredString(d?.idempotencyKey, "idempotencyKey")];
  },

  AGGREGATE_METRICS: (data) => {
    const d = data as import("../core/types.js").AggregateMetricsJobData;
    return [
      ...enumValue(d?.period, "period", ["daily", "weekly", "monthly"]),
      ...requiredString(d?.date, "date"),
      ...requiredString(d?.idempotencyKey, "idempotencyKey"),
    ];
  },

  AUDIT_LOG: (data) => {
    const d = data as import("../core/types.js").AuditLogJobData;
    return [
      ...requiredString(d?.action, "action"),
      ...requiredString(d?.actorId, "actorId"),
      ...requiredString(d?.entityType, "entityType"),
      ...requiredString(d?.entityId, "entityId"),
      ...requiredString(d?.idempotencyKey, "idempotencyKey"),
    ];
  },

  MAINTENANCE_TASK: (data) => {
    const d = data as import("../core/types.js").MaintenanceTaskJobData;
    return [...requiredString(d?.taskName, "taskName"), ...requiredString(d?.idempotencyKey, "idempotencyKey")];
  },

  DATA_RETENTION: (data) => {
    const d = data as import("../core/types.js").DataRetentionJobData;
    return [
      ...enumValue(d?.entityType, "entityType", ["audit_log", "session", "temp_export"]),
      ...requiredNumber(d?.olderThanDays, "olderThanDays"),
      ...requiredNumber(d?.batchSize, "batchSize"),
      ...requiredString(d?.idempotencyKey, "idempotencyKey"),
    ];
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate job data for the given job type.
 *
 * @returns A validation result with `valid: true` or a list of error messages.
 */
export function validateJobData<T extends JobType>(jobType: T, data: unknown): ValidationResult {
  const validator = validators[jobType];
  if (!validator) {
    return {
      valid: false,
      errors: [`Unknown job type: ${jobType}`],
    };
  }

  const errors = validator(data);
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate and throw if invalid.
 *
 * @throws {JobValidationError} If validation fails.
 */
export function assertJobData<T extends JobType>(jobType: T, data: unknown): asserts data is JobDataMap[T] {
  const result = validateJobData(jobType, data);
  if (!result.valid) {
    throw new JobValidationError(jobType, result.errors);
  }
}
