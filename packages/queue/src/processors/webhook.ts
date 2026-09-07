/**
 * @module processors/webhook
 * @description Webhook processing for incoming callbacks from Telebirr
 * and SMSEthiopia (FR-400, FR-1000).
 *
 * Telebirr payment notifications are verified against the platform public
 * key (`TELEBIRR_PUBLIC_KEY`) before they are routed; payloads with a
 * missing or invalid signature are rejected permanently.
 */

import { UnrecoverableError } from 'bullmq'
import type { JobProcessor, ProcessorEntry, WebhookProcessJobData } from '../core/types.js'
import { JobType } from '../core/types.js'
import { QUEUE_NAMES } from '../definitions/queues.js'
import {
  buildStringToSign,
  getTelebirrSignaturePadding,
  getTelebirrVerificationKey,
  normalizeSmsStatus,
  verifyPayload,
} from '../integrations/index.js'
import { getLogger } from '../utils/logger.js'

// ---------------------------------------------------------------------------
// Webhook Process Processor
// ---------------------------------------------------------------------------

/**
 * Process incoming webhooks from external providers.
 *
 * Telebirr callbacks are signature-verified, then normalized and routed to
 * PURCHASE_COMPLETE. SMSEthiopia delivery receipts are normalized into the
 * message status lifecycle (ACCEPTED / SENT / DELIVERED / FAILED / EXPIRED).
 *
 * Expected side effects:
 * - Validate webhook signature (Telebirr)
 * - Parse and normalise the payload
 * - Route to the appropriate downstream handler
 * - For Telebirr: enqueue PURCHASE_COMPLETE
 * - For SMSEthiopia: process SMS delivery receipts
 * - Store raw webhook for audit purposes
 */
export const processWebhook: JobProcessor<WebhookProcessJobData> = async (data, job) => {
  const { source, idempotencyKey } = data
  const logger = getLogger().child({ processor: 'webhook', jobId: job.id })

  logger.debug(`Processing webhook from ${source}`, { idempotencyKey })

  switch (source) {
    case 'telebirr': {
      const publicKey = getTelebirrVerificationKey()
      if (!publicKey) {
        throw new UnrecoverableError(
          'Telebirr webhook cannot be verified – set TELEBIRR_PUBLIC_KEY (or TELEBIRR_PUBLIC_KEY_PATH)',
        )
      }

      const sign = data.payload['sign']
      if (typeof sign !== 'string' || sign.length === 0) {
        throw new UnrecoverableError('Telebirr webhook payload is missing the sign field')
      }

      const isValid = verifyPayload(
        buildStringToSign(data.payload),
        sign,
        publicKey,
        getTelebirrSignaturePadding(),
      )
      if (!isValid) {
        logger.warn('Rejected Telebirr webhook with invalid signature', { idempotencyKey })
        throw new UnrecoverableError('Invalid Telebirr webhook signature')
      }

      const notification = normalizeTelebirrNotification(data.payload)

      // TODO: Route to purchase completion handler – requires the DB schema
      // to resolve purchaseId from merchOrderId/transactionId, then enqueue
      // PURCHASE_COMPLETE with the normalized data below.

      return {
        source,
        processed: true,
        routedTo: 'PURCHASE_COMPLETE',
        ...notification,
        processedAt: new Date().toISOString(),
      }
    }

    case 'sms_ethiopia': {
      const messageId = pickString(data.payload, ['messageId', 'message_id', 'id'])
      const rawStatus = pickString(data.payload, ['status'])
      const status = rawStatus ? normalizeSmsStatus(rawStatus) : 'UNKNOWN'

      // TODO: Update the notification record for messageId with the delivery
      // status once the notifications DB schema is wired up.

      return {
        source,
        processed: true,
        routedTo: 'SMS_DELIVERY_RECEIPT',
        ...(messageId ? { messageId } : {}),
        status,
        processedAt: new Date().toISOString(),
      }
    }

    default: {
      logger.warn(`Unknown webhook source: ${source}`)
      return {
        source,
        processed: false,
        reason: 'Unknown source',
        processedAt: new Date().toISOString(),
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a verified Telebirr payment notification into the shape
 * expected by PURCHASE_COMPLETE. Reads the camelCase fields of the API's
 * webhook contract with snake_case fallbacks.
 */
function normalizeTelebirrNotification(payload: Record<string, unknown>): {
  transactionId: string | null
  merchOrderId: string | null
  status: 'success' | 'failed' | 'pending'
} {
  return {
    transactionId: pickString(payload, ['transactionId', 'transaction_id', 'trans_id']),
    merchOrderId: pickString(payload, ['merchOrderId', 'merch_order_id', 'outTradeNo']),
    status: mapTelebirrStatus(payload['status']),
  }
}

/** Map Telebirr status strings onto the purchase completion status union. */
function mapTelebirrStatus(value: unknown): 'success' | 'failed' | 'pending' {
  if (value === 'SUCCESS' || value === 'PAY_SUCCESS') return 'success'
  if (value === 'FAILED' || value === 'PAY_FAIL') return 'failed'
  return 'pending'
}

function pickString(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return null
}

// ---------------------------------------------------------------------------
// Processor Entries
// ---------------------------------------------------------------------------

export const webhookProcessors: ProcessorEntry<WebhookProcessJobData>[] = [
  {
    jobType: JobType.WEBHOOK_PROCESS,
    processor: processWebhook,
    queueName: QUEUE_NAMES.WEBHOOKS,
    concurrency: 5,
  },
]
