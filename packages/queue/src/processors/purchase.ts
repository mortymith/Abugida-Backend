/**
 * @module processors/purchase
 * @description Processors for purchase-related jobs: initiation and
 * completion from payment callbacks (Telebirr).
 *
 * These processors integrate with the database (via Drizzle ORM and
 * `@abugida/db-schemas`) and use idempotency to prevent duplicate
 * purchase processing from webhook retries.
 */

import type {
  AnyProcessorEntry,
  JobProcessor,
  PurchaseInitiateJobData,
  PurchaseCompleteJobData,
} from "../core/types.js";
import { JobType } from "../core/types.js";
import { QUEUE_NAMES } from "../definitions/queues.js";

// ---------------------------------------------------------------------------
// Purchase Initiate Processor
// ---------------------------------------------------------------------------

/**
 * Process a purchase initiation.
 *
 * Expected side effects:
 * - Validate course existence and pricing
 * - Create a purchase record in the database (pending status)
 * - Initiate payment with the payment provider
 * - Return the payment redirect URL or reference
 *
 * Integration notes:
 * - Import `db` from `@abugida/db-schemas`
 * - Import `purchases` table from `@abugida/db-schemas/finance`
 * - Use Drizzle transactions for atomicity
 */
export const processPurchaseInitiate: JobProcessor<PurchaseInitiateJobData> = async (data, job) => {
  const { userId, courseId, amount, currency, idempotencyKey } = data;

  // TODO: Replace with actual database integration:
  // const db = getDatabase();
  // const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });
  // if (!course) throw new Error(`Course not found: ${courseId}`);
  //
  // const [purchase] = await db.insert(purchases).values({
  //   userId,
  //   courseId,
  //   amount,
  //   currency,
  //   paymentMethod,
  //   status: "pending",
  //   idempotencyKey,
  // }).returning();

  console.debug(
    `[purchase:initiate] Processing purchase for user=${userId} course=${courseId} amount=${amount}${currency}`,
    { jobId: job.id, idempotencyKey }
  );

  // Placeholder result – in production, return the payment reference
  return {
    purchaseId: `purchase_${job.id}`,
    status: "pending",
    paymentReference: `ref_${Date.now()}`,
  };
};

// ---------------------------------------------------------------------------
// Purchase Complete Processor
// ---------------------------------------------------------------------------

/**
 * Process a purchase completion callback from Telebirr.
 *
 * Expected side effects:
 * - Validate the callback payload signature
 * - Update purchase record to success/failed
 * - Create enrollments if purchase was successful
 * - Send confirmation notification
 *
 * Integration notes:
 * - Verify Telebirr signature using `X-Signature` header
 * - Use Drizzle transaction: update purchase + create enrollment atomically
 * - Enqueue `BUNDLE_ENROLLMENT_CREATE` if the purchase is for a bundle
 */
export const processPurchaseComplete: JobProcessor<PurchaseCompleteJobData> = async (data, job) => {
  const { purchaseId, transactionId, status, idempotencyKey } = data;

  console.debug(
    `[purchase:complete] Processing completion for purchase=${purchaseId} tx=${transactionId} status=${status}`,
    { jobId: job.id, idempotencyKey }
  );

  // TODO: Replace with actual database integration:
  // const db = getDatabase();
  //
  // Verify signature
  // const isValid = verifyTelebirrSignature(callbackPayload, data.headers);
  // if (!isValid) throw new Error('Invalid callback signature');
  //
  // Update purchase status
  // await db.update(purchases)
  //   .set({ status, transactionId, completedAt: new Date() })
  //   .where(eq(purchases.id, purchaseId));
  //
  // If successful, trigger enrollment creation
  // if (status === 'success') {
  //   const purchase = await db.query.purchases.findFirst(...);
  //   // Enqueue enrollment job...
  // }

  return {
    purchaseId,
    transactionId,
    status,
    processedAt: new Date().toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Processor Entries
// ---------------------------------------------------------------------------

export const purchaseProcessors: AnyProcessorEntry[] = [
  {
    jobType: JobType.PURCHASE_INITIATE,
    processor: processPurchaseInitiate,
    queueName: QUEUE_NAMES.PURCHASES,
    concurrency: 5,
  },
  {
    jobType: JobType.PURCHASE_COMPLETE,
    processor: processPurchaseComplete,
    queueName: QUEUE_NAMES.PURCHASES,
    concurrency: 5,
  },
];
