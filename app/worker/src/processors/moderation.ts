/**
 * @module processors/moderation
 * @description Processor for submitting content into the moderation queue.
 */

import type { ModerationSubmitJobData } from '@abugida/queue'
import type { JobProcessor } from '@/runtime/types'
import * as BullMQ from 'bullmq'

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
 *
 * Status: **gated**. The processor is a placeholder, so it throws
 * `UnrecoverableError` instead of returning a success result. BullMQ keeps
 * the job in the failed set instead of completing and removing it, so queued
 * work is never silently discarded (ADR-028, Risks).
 */
export const processModerationSubmit: JobProcessor<ModerationSubmitJobData> = async () => {
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

  throw new BullMQ.UnrecoverableError(
    'MODERATION_SUBMIT is not implemented yet: creating the moderation record requires the @abugida/database integration (ADR-028).',
  )
}
