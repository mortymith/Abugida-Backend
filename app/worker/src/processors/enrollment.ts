/**
 * @module processors/enrollment
 * @description Processors for enrollment-related jobs: creating bundle
 * enrollments and updating enrollment progress.
 */

import type { BundleEnrollmentCreateJobData, EnrollmentProgressUpdateJobData } from '@abugida/queue'
import type { JobProcessor } from '@/runtime/types'
import * as BullMQ from 'bullmq'

// ---------------------------------------------------------------------------
// Bundle Enrollment Create Processor
// ---------------------------------------------------------------------------

/**
 * Create individual enrollments for every course in a bundle.
 *
 * Expected side effects:
 * - Look up the bundle to get course IDs
 * - Create an enrollment record for each course
 * - Update bundle purchase record
 * - Send enrollment confirmation notifications
 *
 * Integration notes:
 * - Import `db` from `@abugida/database`
 * - Import `enrollments` from `@abugida/database/learning`
 * - Import `bundles` from `@abugida/database/catalog`
 * - Use Drizzle transaction for atomicity
 *
 * Status: **gated**. The processor is a placeholder, so it throws
 * `UnrecoverableError` instead of returning a success result. BullMQ keeps
 * the job in the failed set instead of completing and removing it, so queued
 * work is never silently discarded (ADR-028, Risks).
 */
export const processBundleEnrollmentCreate: JobProcessor<
  BundleEnrollmentCreateJobData
> = async () => {
  // TODO: Replace with actual database integration:
  // const db = getDatabase();
  //
  // const createdEnrollments = await db.transaction(async (tx) => {
  //   const results = [];
  //   for (const courseId of courseIds) {
  //     const [enrollment] = await tx.insert(enrollments).values({
  //       userId,
  //       courseId,
  //       bundleId,
  //       status: 'active',
  //       progress: 0,
  //       enrolledAt: new Date(),
  //       idempotencyKey: `${idempotencyKey}:${courseId}`,
  //     }).returning();
  //     results.push(enrollment);
  //   }
  //   return results;
  // });

  throw new BullMQ.UnrecoverableError(
    'BUNDLE_ENROLLMENT_CREATE is not implemented yet: creating the enrollments requires the @abugida/database integration (ADR-028).',
  )
}
// ---------------------------------------------------------------------------
// Enrollment Progress Update Processor
// ---------------------------------------------------------------------------

/**
 * Update enrollment progress after lesson completion.
 *
 * Expected side effects:
 * - Recalculate progress percentage
 * - Update enrollment record
 * - Check for course completion
 * - Trigger certificate generation if 100%
 *
 * Status: **gated**. The processor is a placeholder, so it throws
 * `UnrecoverableError` instead of returning a success result. BullMQ keeps
 * the job in the failed set instead of completing and removing it, so queued
 * work is never silently discarded (ADR-028, Risks).
 */
export const processEnrollmentProgressUpdate: JobProcessor<
  EnrollmentProgressUpdateJobData
> = async () => {
  // TODO: Replace with actual database integration:
  // const db = getDatabase();
  // await db.update(enrollments)
  //   .set({ progress, updatedAt: new Date() })
  //   .where(eq(enrollments.id, enrollmentId));
  //
  // if (progress >= 100) {
  //   // Enqueue certificate generation
  // }

  throw new BullMQ.UnrecoverableError(
    'ENROLLMENT_PROGRESS_UPDATE is not implemented yet: updating the enrollment requires the @abugida/database integration (ADR-028).',
  )
}
