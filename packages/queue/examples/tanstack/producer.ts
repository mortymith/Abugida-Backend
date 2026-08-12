/**
 * @example tanstack/producer
 * @description Example of enqueuing jobs from a TanStack Start server function.
 */

import { getTanStackQueueClient, mergeWithDefaults, JobType, type DataExportJobData } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const config = mergeWithDefaults({
  redis: {
    hostname: "localhost",
    port: 6379,
  },
  logging: { level: "debug", format: "pretty" },
});

// ---------------------------------------------------------------------------
// Server Functions (TanStack Start)
// ---------------------------------------------------------------------------

/**
 * Server function: Request a GDPR data export.
 * Can be called from a TanStack Start route or component.
 */
export async function requestDataExport(userId: string, format: "json" | "csv" = "json"): Promise<string> {
  const queue = getTanStackQueueClient(config);

  const jobId = await queue.enqueue(JobType.DATA_EXPORT, {
    userId,
    format,
    requestedAt: new Date().toISOString(),
    idempotencyKey: `export:${userId}:${Date.now()}`,
  } satisfies DataExportJobData);

  return jobId;
}

/**
 * Server function: Submit a review for moderation.
 */
export async function submitReviewForModeration(
  reviewId: string,
  content: string,
  submittedBy: string
): Promise<string> {
  const queue = getTanStackQueueClient(config);

  const jobId = await queue.enqueue(JobType.MODERATION_SUBMIT, {
    entityType: "review",
    entityId: reviewId,
    content,
    submittedBy,
    idempotencyKey: `moderation:review:${reviewId}`,
  });

  return jobId;
}

/**
 * Server function: Trigger course statistics recalculation.
 */
export async function triggerStatsRecalculation(courseId: string): Promise<string> {
  const queue = getTanStackQueueClient(config);

  const jobId = await queue.enqueue(JobType.RECALCULATE_STATS, {
    courseId,
    idempotencyKey: `stats:${courseId}:${Date.now()}`,
  });

  return jobId;
}

// ---------------------------------------------------------------------------
// Usage in TanStack Start Route
// ---------------------------------------------------------------------------

// export default function ExportPage() {
//   const createMutation = createServerFn()
//     .validator((data: { userId: string; format: "json" | "csv" }) => data)
//     .handler(async ({ data }) => {
//       const jobId = await requestDataExport(data.userId, data.format);
//       return { jobId };
//     });
//
//   // ... component JSX
// }

console.log("[example:tanstack:producer] TanStack Start producer example");
console.log("Import these server functions into your TanStack Start routes.");
