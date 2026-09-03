/**
 * @module webhooks.service
 *
 * Business logic for the webhooks feature module. Stores incoming webhook
 * events and enqueues them for async processing.
 */

import type { QueueClient } from '@abugida/queue'
import { JobType } from '@abugida/queue'
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
): WebhooksService {
  return {
    async handleTelebirrWebhook(payload, headers) {
      const idempotencyKey = `webhook:telebirr:${payload.externalTransactionId ?? payload.transactionId ?? Date.now()}`

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
      const idempotencyKey = `webhook:sms:${payload.messageId ?? Date.now()}`

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
