/**
 * @module processors/audit
 * @description Async audit logging processor. Offloads audit writes
 * from the critical path to a background queue for better performance.
 */

import type { AuditLogJobData } from '@abugida/queue'
import type { JobProcessor } from '@/runtime/types'
import * as BullMQ from 'bullmq'

// ---------------------------------------------------------------------------
// Audit Log Processor
// ---------------------------------------------------------------------------

/**
 * Process audit logging asynchronously.
 *
 * Expected side effects:
 * - Write audit log entry to the database
 * - Include actor, action, entity, timestamp, and metadata
 * - Support GDPR audit trail requirements
 * - Handle bulk audit writes efficiently
 *
 * Status: **gated**. The processor is a placeholder, so it throws
 * `UnrecoverableError` instead of returning a success result. BullMQ keeps
 * the job in the failed set instead of completing and removing it, so queued
 * work is never silently discarded (ADR-028, Risks).
 */
export const processAuditLog: JobProcessor<AuditLogJobData> = async () => {
  // TODO: Replace with actual database integration:
  // const db = getDatabase();
  //
  // await db.insert(auditLogs).values({
  //   action,
  //   actorId,
  //   entityType,
  //   entityId,
  //   metadata: metadata ?? {},
  //   createdAt: new Date(),
  //   idempotencyKey,
  // }).onConflictDoNothing();

  throw new BullMQ.UnrecoverableError(
    'AUDIT_LOG is not implemented yet: the audit write requires the @abugida/database integration (ADR-028).',
  )
}
