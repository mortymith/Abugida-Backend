/**
 * @module processors/purchase
 * @description Processors for purchase-related jobs: initiation via the
 * Telebirr H5 C2B payment gateway (see `integrations/telebirr`) and
 * completion from payment callbacks.
 *
 * These processors integrate with the database (via Drizzle ORM and
 * `@abugida/db-schemas`) and use idempotency to prevent duplicate
 * purchase processing from webhook retries.
 */

import { createHash } from 'node:crypto'
import { UnrecoverableError } from 'bullmq'
import type {
  AnyProcessorEntry,
  JobProcessor,
  PurchaseInitiateJobData,
  PurchaseCompleteJobData,
} from '../core/types.js'
import { JobType } from '../core/types.js'
import { QUEUE_NAMES } from '../definitions/queues.js'
import { TelebirrError, getTelebirrClient } from '../integrations/index.js'
import { toJobError } from '../integrations/job-error.js'
import { getLogger } from '../utils/logger.js'

// ---------------------------------------------------------------------------
// Purchase Initiate Processor
// ---------------------------------------------------------------------------

/**
 * Process a purchase initiation by creating a Telebirr prepay order.
 *
 * The merchant order id is derived deterministically from the idempotency
 * key, so retries and duplicate jobs reuse the same Telebirr order.
 * The checkout URL is included when `TELEBIRR_CHECKOUT_BASE_URL` is set.
 *
 * Expected side effects:
 * - Create a purchase record in the database (pending status)
 * - Create a Telebirr prepay order (signed with the merchant key)
 * - Return the payment reference (prepay id) and checkout URL
 *
 * Integration notes:
 * - Import `db` from `@abugida/db-schemas`
 * - Import `purchases` table from `@abugida/db-schemas/finance`
 * - Use Drizzle transactions for atomicity
 */
export const processPurchaseInitiate: JobProcessor<PurchaseInitiateJobData> = async (data, job) => {
  const { userId, courseId, amount, currency, paymentMethod, idempotencyKey, title } = data
  const logger = getLogger().child({ processor: 'purchase:initiate', jobId: job.id })

  if (paymentMethod !== 'telebirr') {
    // No other gateway is implemented; retrying cannot succeed.
    throw new UnrecoverableError(`Unsupported payment method: ${paymentMethod}`)
  }
  if (!(amount > 0)) {
    throw new UnrecoverableError(`Purchase amount must be positive, got: ${amount}`)
  }
  if (!/^[A-Z]{3}$/.test(currency.toUpperCase())) {
    throw new UnrecoverableError(`Purchase currency must be a 3-letter code, got: ${currency}`)
  }

  logger.info(
    `Creating Telebirr order for user=${userId} course=${courseId} amount=${amount} ${currency}`,
    {
      idempotencyKey,
    },
  )

  try {
    const telebirr = getTelebirrClient()
    // Deterministic per idempotency key so retries map to the same order
    // (Telebirr merchant order ids must be alphanumeric, <= 64 chars).
    const merchOrderId = buildMerchantOrderId(idempotencyKey)
    const order = await telebirr.createOrder({
      title: buildOrderTitle(title, courseId),
      amount,
      merchOrderId,
      currency,
    })

    let checkoutUrl: string | undefined
    try {
      checkoutUrl = telebirr.buildCheckoutUrl(order.prepayId)
    } catch (error) {
      if (!(error instanceof TelebirrError && error.code === 'TELEBIRR_CONFIG')) throw error
      logger.warn('TELEBIRR_CHECKOUT_BASE_URL is not set – returning order without checkout URL', {
        merchOrderId,
      })
    }

    // TODO: persist the purchase (status "pending") with Drizzle inside a
    // transaction, keyed by idempotencyKey:
    // const [purchase] = await db.insert(purchases).values({
    //   userId,
    //   courseId,
    //   amount,
    //   currency,
    //   paymentMethod,
    //   status: 'pending',
    //   idempotencyKey,
    // }).returning();

    return {
      purchaseId: `purchase_${job.id}`, // TODO: replace with the DB purchase id
      status: 'pending',
      paymentReference: order.prepayId,
      merchOrderId: order.merchOrderId,
      ...(checkoutUrl ? { checkoutUrl } : {}),
      processedAt: new Date().toISOString(),
    }
  } catch (error) {
    throw toJobError(error)
  }
}

// ---------------------------------------------------------------------------
// Purchase Complete Processor
// ---------------------------------------------------------------------------

/**
 * Process a purchase completion callback from Telebirr.
 *
 * The callback payload's signature is verified with the Telebirr platform
 * public key; payloads with an invalid signature are rejected permanently
 * (they never become valid on retry).
 *
 * Expected side effects:
 * - Validate the callback payload signature
 * - Update purchase record to success/failed
 * - Create enrollments if purchase was successful
 * - Send confirmation notification
 *
 * Integration notes:
 * - Verification uses `TELEBIRR_PUBLIC_KEY` (see `integrations/telebirr`)
 * - Use Drizzle transaction: update purchase + create enrollment atomically
 * - Enqueue `BUNDLE_ENROLLMENT_CREATE` if the purchase is for a bundle
 */
export const processPurchaseComplete: JobProcessor<PurchaseCompleteJobData> = async (data, job) => {
  const { purchaseId, transactionId, status, callbackPayload, idempotencyKey } = data
  const logger = getLogger().child({ processor: 'purchase:complete', jobId: job.id })

  logger.info(
    `Processing completion for purchase=${purchaseId} tx=${transactionId} status=${status}`,
    {
      idempotencyKey,
    },
  )

  try {
    const telebirr = getTelebirrClient()
    if (!telebirr.verifyCallback(callbackPayload)) {
      throw new UnrecoverableError('Invalid Telebirr callback signature')
    }

    // TODO: Replace with actual database integration:
    // const db = getDatabase();
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
    }
  } catch (error) {
    throw toJobError(error)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMerchantOrderId(idempotencyKey: string): string {
  const hash = createHash('sha256').update(idempotencyKey).digest('hex')
  return `ABG${hash.slice(0, 24).toUpperCase()}`
}

function buildOrderTitle(title: string | undefined, courseId: string): string {
  if (title && title.trim().length > 0) return title.trim()
  const courseLabel = courseId.replace(/[^A-Za-z0-9]+/g, '')
  return courseLabel.length > 0 ? `Abugida purchase ${courseLabel}` : 'Abugida purchase'
}

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
]
