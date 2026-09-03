/**
 * @module webhooks.repository
 *
 * Database operations for the webhooks feature module.
 */

import type { DatabaseClient } from '@abugida/database/client'
import { webhookEvents } from '@abugida/database/ops'

// ── Types ──────────────────────────────────────────────────────────────────

export interface CreateWebhookEventRow {
  webhookUrl: string
  eventType: string
  payload: Record<string, unknown>
}

export interface WebhookEventRow {
  id: number
  publicId: string
  webhookUrl: string
  eventType: string
  payload: Record<string, unknown>
  status: string
  createdAt: Date
}

// ── Repository ─────────────────────────────────────────────────────────────

export interface WebhooksRepository {
  createWebhookEvent(data: CreateWebhookEventRow): Promise<WebhookEventRow>
}

export function createWebhooksRepository(db: DatabaseClient): WebhooksRepository {
  return {
    async createWebhookEvent(data) {
      const [row] = await db
        .insert(webhookEvents)
        .values({
          webhookUrl: data.webhookUrl,
          eventType: data.eventType,
          payload: data.payload,
          status: 'pending',
        })
        .returning({
          id: webhookEvents.id,
          publicId: webhookEvents.publicId,
          webhookUrl: webhookEvents.webhookUrl,
          eventType: webhookEvents.eventType,
          payload: webhookEvents.payload,
          status: webhookEvents.status,
          createdAt: webhookEvents.createdAt,
        })
      return {
        ...row!,
        payload: row!.payload as Record<string, unknown>,
      }
    },
  }
}
