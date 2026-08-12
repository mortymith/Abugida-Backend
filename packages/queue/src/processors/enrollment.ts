/**
 * @module processors/enrollment
 * @description Processors for enrollment-related jobs: creating bundle
 * enrollments and updating enrollment progress.
 */

import type {
  AnyProcessorEntry,
  JobProcessor,
  BundleEnrollmentCreateJobData,
  EnrollmentProgressUpdateJobData,
} from "../core/types.js";
import { JobType } from "../core/types.js";
import { QUEUE_NAMES } from "../definitions/queues.js";

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
 * - Import `db` from `@abugida/db-schemas`
 * - Import `enrollments` from `@abugida/db-schemas/enrollment`
 * - Import `bundles` from `@abugida/db-schemas/course`
 * - Use Drizzle transaction for atomicity
 */
export const processBundleEnrollmentCreate: JobProcessor<BundleEnrollmentCreateJobData> = async (data, job) => {
  const { userId, bundleId, courseIds, idempotencyKey } = data;

  console.debug(
    `[enrollment:bundle] Creating enrollments for user=${userId} bundle=${bundleId} courses=${courseIds.length}`,
    { jobId: job.id, idempotencyKey }
  );

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

  return {
    bundleId,
    userId,
    enrollmentsCreated: courseIds.map((courseId) => ({
      courseId,
      enrollmentId: `enrollment_${job.id}_${courseId}`,
    })),
  };
};

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
 */
export const processEnrollmentProgressUpdate: JobProcessor<EnrollmentProgressUpdateJobData> = async (data, job) => {
  const { enrollmentId, completedLessons, totalLessons, idempotencyKey } = data;

  const progress = Math.round((completedLessons / totalLessons) * 100);

  console.debug(`[enrollment:progress] Updating enrollment=${enrollmentId} progress=${progress}%`, {
    jobId: job.id,
    idempotencyKey,
  });

  // TODO: Replace with actual database integration:
  // const db = getDatabase();
  // await db.update(enrollments)
  //   .set({ progress, updatedAt: new Date() })
  //   .where(eq(enrollments.id, enrollmentId));
  //
  // if (progress >= 100) {
  //   // Enqueue certificate generation
  // }

  return { enrollmentId, progress, completedLessons, totalLessons };
};

// ---------------------------------------------------------------------------
// Processor Entries
// ---------------------------------------------------------------------------

export const enrollmentProcessors: AnyProcessorEntry[] = [
  {
    jobType: JobType.BUNDLE_ENROLLMENT_CREATE,
    processor: processBundleEnrollmentCreate,
    queueName: QUEUE_NAMES.ENROLLMENTS,
    concurrency: 3,
  },
  {
    jobType: JobType.ENROLLMENT_PROGRESS_UPDATE,
    processor: processEnrollmentProgressUpdate,
    queueName: QUEUE_NAMES.ENROLLMENTS,
    concurrency: 3,
  },
];
