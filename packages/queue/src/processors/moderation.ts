/**
 * @module processors/moderation
 * @description Processor for submitting content into the moderation queue.
 */

import type { JobProcessor, ProcessorEntry, ModerationSubmitJobData } from "../core/types.js";
import { JobType } from "../core/types.js";
import { QUEUE_NAMES } from "../definitions/queues.js";

// ---------------------------------------------------------------------------
// Moderation Submit Processor
// ---------------------------------------------------------------------------

/**
 * Process submitted content into the moderation queue.
 *
 * Expected side effects:
 * - Create a moderation record in the database
 * - Run automated content checks (profanity filter, etc.)
 * - If auto-approved, update content status immediately
 * - If flagged, notify moderators
 * - Record in audit log
 */
export const processModerationSubmit: JobProcessor<ModerationSubmitJobData> = async (data, job) => {
  const { entityType, entityId, submittedBy, idempotencyKey } = data;

  console.debug(`[moderation:submit] Processing ${entityType}=${entityId} from user=${submittedBy}`, {
    jobId: job.id,
    idempotencyKey,
  });

  // TODO: Replace with actual integration:
  // const db = getDatabase();
  //
  // 1. Run automated checks
  // const autoCheck = await runContentFilter(content);
  //
  // 2. Create moderation record
  // const [record] = await db.insert(moderations).values({
  //   entityType,
  //   entityId,
  //   content,
  //   submittedBy,
  //   status: autoCheck.passed ? 'approved' : 'pending_review',
  //   autoCheckResult: autoCheck,
  //   idempotencyKey,
  // }).returning();
  //
  // 3. If pending review, notify moderators
  // if (record.status === 'pending_review') {
  //   // Enqueue notification...
  // }

  return {
    entityType,
    entityId,
    moderationId: `mod_${job.id}`,
    status: "pending_review",
    processedAt: new Date().toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Processor Entries
// ---------------------------------------------------------------------------

export const moderationProcessors: ProcessorEntry<ModerationSubmitJobData>[] = [
  {
    jobType: JobType.MODERATION_SUBMIT,
    processor: processModerationSubmit,
    queueName: QUEUE_NAMES.MODERATION,
    concurrency: 3,
  },
];
