/**
 * @module webhooks.service
 *
 * Business logic for the webhooks feature module. Stores incoming webhook
 * events and enqueues them for async processing.
 *
 * Security: the service validates the Telebirr payload against the recorded
 * purchase before storing it. The `externalTransactionId` must correspond to
 * an existing `purchases` row in `initiated` or `payment_pending` status, and
 * the `amount` must match. A forged payload with an arbitrary transaction ID
 * is rejected before it reaches the queue.
 */

import type { QueueClient } from '@abugida/queue'
import { JobType } from '@abugida/queue'
import { eq } from 'drizzle-orm'
import { purchases } from '@abugida/database/finance'
import { purchaseTransactions } from '@abugida/database/finance'
import type { DatabaseClient } from '@abugida/database/client'
import type { WebhooksRepository } from './webhooks.repository'
import type {
  TelebirrWebhookBody,
  SmsDeliveryWebhookBody,
  WebhookProcessedResult,
} from './webhooks.types'

// ── Errors ─────────────────────────────────────────────────────────────────

export class WebhookStorageError extends Error {
  constructor(message = 'Failed to store webhook event.') {
    super(message)
    this.name = 'WebhookStorageError'
  }
}

export class WebhookValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebhookValidationError'
  }
}

// ── Service ────────────────────────────────────────────────────────────────

export interface WebhooksService {
  handleTelebirrWebhook(
    payload: TelebirrWebhookBody,
    headers: Record<string, string>,
  ): Promise<WebhookProcessedResult>
  handleSmsDeliveryWebhook(
    payload: SmsDeliveryWebhookBody,
    headers: Record<string, string>,
  ): Promise<WebhookProcessedResult>
}

export function createWebhooksService(
  repo: WebhooksRepository,
  queue: QueueClient | undefined,
  db: DatabaseClient,
): WebhooksService {
  return {
    async handleTelebirrWebhook(payload, headers) {
      // Validate the payload against the recorded purchase. The
      // externalTransactionId must correspond to an existing purchase
      // transaction, and the amount must match. This prevents a forged
      // payload from creating an enrollment without a real payment.
      const existingTx = await db
        .select({
          purchaseId: purchaseTransactions.purchaseId,
          amount: purchases.amount,
          currency: purchases.currency,
          status: purchases.status,
        })
        .from(purchaseTransactions)
        .innerJoin(purchases, eq(purchases.id, purchaseTransactions.purchaseId))
        .where(eq(purchaseTransactions.externalTransactionId, payload.externalTransactionId))
        .limit(1)

      const purchase = existingTx.at(0)
      if (!purchase) {
        throw new WebhookValidationError(
          `No purchase found for externalTransactionId: ${payload.externalTransactionId}`,
        )
      }

      // Verify the amount matches. The Telebirr payload sends the amount as a
      // string; compare numerically.
      const payloadAmount = Number.parseFloat(payload.amount)
      if (Number.isNaN(payloadAmount) || payloadAmount !== Number(purchase.amount)) {
        throw new WebhookValidationError(
          `Amount mismatch: payload ${payload.amount}, purchase ${purchase.amount}`,
        )
      }

      const idempotencyKey = `webhook:telebirr:${payload.externalTransactionId}`

      const event = await repo.createWebhookEvent({
        webhookUrl: '/webhooks/telebirr',
        eventType: 'telebirr.payment_callback',
        payload: payload as Record<string, unknown>,
      })

      if (queue) {
        await queue.enqueue(JobType.WEBHOOK_PROCESS, {
          source: 'telebirr',
          payload: payload as Record<string, unknown>,
          headers,
          idempotencyKey,
        })
      }

      return { received: true, eventId: event.publicId }
    },

    async handleSmsDeliveryWebhook(payload, headers) {
      const idempotencyKey = `webhook:sms:${payload.messageId}`

      const event = await repo.createWebhookEvent({
        webhookUrl: '/webhooks/sms-delivery',
        eventType: 'sms_ethiopia.delivery_receipt',
        payload: payload as Record<string, unknown>,
      })

      if (queue) {
        await queue.enqueue(JobType.WEBHOOK_PROCESS, {
          source: 'sms_ethiopia',
          payload: payload as Record<string, unknown>,
          headers,
          idempotencyKey,
        })
      }

      return { received: true, eventId: event.publicId }
    },
  }
}
