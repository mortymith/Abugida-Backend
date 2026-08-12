/**
 * @module processors/index
 * @description Central processor registry that aggregates all job processors.
 * Import this module and pass `allProcessors` to the worker factory to
 * activate every job type.
 */

import type { AnyProcessorEntry } from "../core/types.js";
import { purchaseProcessors } from "./purchase.js";
import { enrollmentProcessors } from "./enrollment.js";
import { lessonProcessors } from "./lesson.js";
import { exportProcessors } from "./export.js";
import { webhookProcessors } from "./webhook.js";
import { notificationProcessors } from "./notification.js";
import { moderationProcessors } from "./moderation.js";
import { statisticsProcessors } from "./statistics.js";
import { auditProcessors } from "./audit.js";
import { maintenanceProcessors } from "./maintenance.js";

// ---------------------------------------------------------------------------
// Aggregate all processors
// ---------------------------------------------------------------------------

/**
 * All registered processors, ready to pass to the worker factory.
 * Each entry maps a {@link JobType} to its processor implementation.
 */
export const allProcessors: AnyProcessorEntry[] = [
  ...purchaseProcessors,
  ...enrollmentProcessors,
  ...lessonProcessors,
  ...exportProcessors,
  ...webhookProcessors,
  ...notificationProcessors,
  ...moderationProcessors,
  ...statisticsProcessors,
  ...auditProcessors,
  ...maintenanceProcessors,
];

/**
 * Get processors by queue name. Useful for running selective workers
 * (e.g., only the purchases queue on a dedicated instance).
 */
export function getProcessorsForQueue(queueName: string): AnyProcessorEntry[] {
  return allProcessors.filter((p) => p.queueName === queueName);
}

/**
 * Get processors by job type.
 */
export function getProcessorForJobType(jobType: string): AnyProcessorEntry | undefined {
  return allProcessors.find((p) => p.jobType === jobType);
}
