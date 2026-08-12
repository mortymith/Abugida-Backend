/**
 * @module processors/audit
 * @description Async audit logging processor. Offloads audit writes
 * from the critical path to a background queue for better performance.
 */

import type { JobProcessor, ProcessorEntry, AuditLogJobData } from "../core/types.js";
import { JobType } from "../core/types.js";
import { QUEUE_NAMES } from "../definitions/queues.js";

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
 */
export const processAuditLog: JobProcessor<AuditLogJobData> = async (data, job) => {
  const { action, actorId, entityType, entityId, idempotencyKey } = data;

  console.debug(`[audit:log] Recording audit action="${action}" actor=${actorId} entity=${entityType}/${entityId}`, {
    jobId: job.id,
    idempotencyKey,
  });

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

  return {
    action,
    actorId,
    entityType,
    entityId,
    loggedAt: new Date().toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Processor Entries
// ---------------------------------------------------------------------------

export const auditProcessors: ProcessorEntry<AuditLogJobData>[] = [
  {
    jobType: JobType.AUDIT_LOG,
    processor: processAuditLog,
    queueName: QUEUE_NAMES.AUDIT,
    concurrency: 5,
  },
];
