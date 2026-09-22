/**
 * Server-only implementation of S-6.7 API & Webhooks. API keys are stored as
 * SHA-256 hashes with a display prefix (plaintext never persisted). Webhook
 * endpoints live in the ops.webhooks registry; a test delivery performs a
 * real signed HTTPS POST from the server and records the attempt (status,
 * response, error) in ops.webhook_events so delivery logs stay reproducible.
 * Never import from client code.
 */
import { and, desc, eq, isNull, sql } from '@abugida/database'
import { apiKeys, webhookEvents, webhooks } from '@abugida/database/ops'
import { db } from '#/config/db.config'
import { requireSettingsAdmin, writeAudit } from './settings.server-helpers.server'
import {
  generateApiKey,
  generateWebhookSecret,
  hashApiKey,
  maskKey,
  signWebhookPayload,
} from '../settings.api-keys'
import type {
  ApiKeyCreated,
  ApiKeyItem,
  WebhookDeliveryItem,
  WebhookEndpointItem,
  WebhookTestResult,
} from '../settings.types'
import type {
  ApiKeyIdInput,
  CreateApiKeyInput,
  SaveWebhookEndpointInput,
  WebhookIdInput,
} from '../schemas/settings.schema'

const TEST_TIMEOUT_MS = 10_000
const MAX_DELIVERY_LOG = 50

export async function getApiKeysImpl(): Promise<ApiKeyItem[]> {
  await requireSettingsAdmin()

  const rows = await db
    .select({
      publicId: apiKeys.publicId,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      keyHash: apiKeys.keyHash,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      isActive: apiKeys.isActive,
    })
    .from(apiKeys)
    .where(isNull(apiKeys.deletedAt))
    .orderBy(desc(apiKeys.createdAt))

  return rows.map((row) => {
    // Display hash tail so admins can tell keys apart without exposing secrets.
    const tail = row.keyHash.slice(-4)
    return {
      publicId: row.publicId,
      name: row.name,
      keyPrefix: row.keyPrefix,
      maskedKey: maskKey(row.keyPrefix, tail),
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
      isActive: row.isActive,
    }
  })
}

export async function createApiKeyImpl(input: CreateApiKeyInput): Promise<ApiKeyCreated> {
  const adminId = await requireSettingsAdmin()

  const generated = generateApiKey()
  const keyHash = await hashApiKey(generated.key)
  const tail = generated.key.slice(-4)

  const apiKeyRows = await db
    .insert(apiKeys)
    .values({
      userId: adminId,
      name: input.name,
      keyHash,
      keyPrefix: generated.prefix,
      scopes: input.scopes,
      metadata: { createdByScreen: 'S-6.7', tail },
    })
    .returning({ publicId: apiKeys.publicId })
  await writeAudit({
    actorId: adminId,
    action: 'admin_action',
    resourceType: 'user_account',
    metadata: { screen: 'S-6.7', action: 'create_api_key', name: input.name },
  })

  return { publicId: apiKeyRows[0].publicId, key: generated.key, name: input.name }
}

export async function revokeApiKeyImpl(input: ApiKeyIdInput): Promise<{ ok: true }> {
  const adminId = await requireSettingsAdmin()

  await db
    .update(apiKeys)
    .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(apiKeys.publicId, input.publicId))

  await writeAudit({
    actorId: adminId,
    action: 'admin_action',
    resourceType: 'user_account',
    metadata: { screen: 'S-6.7', action: 'revoke_api_key', publicId: input.publicId },
  })
  return { ok: true }
}

export async function getWebhookEndpointsImpl(): Promise<WebhookEndpointItem[]> {
  await requireSettingsAdmin()

  const rows = await db
    .select({
      publicId: webhooks.publicId,
      url: webhooks.url,
      eventType: webhooks.eventType,
      isActive: webhooks.isActive,
      createdAt: webhooks.createdAt,
    })
    .from(webhooks)
    .where(isNull(webhooks.deletedAt))
    .orderBy(desc(webhooks.createdAt))

  return rows.map((row) => ({
    publicId: row.publicId,
    url: row.url,
    eventType: row.eventType,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  }))
}

export async function saveWebhookEndpointImpl(
  input: SaveWebhookEndpointInput,
): Promise<{ ok: true; publicId: string }> {
  const adminId = await requireSettingsAdmin()

  if (!input.url.startsWith('https://')) {
    throw new Error('WEBHOOK_URL_HTTPS_ONLY: webhook targets must use HTTPS')
  }

  let publicId: string
  if (input.publicId) {
    const updated = await db
      .update(webhooks)
      .set({ url: input.url, eventType: input.eventType, isActive: input.isActive })
      .where(eq(webhooks.publicId, input.publicId))
      .returning({ publicId: webhooks.publicId })
    publicId = updated[0].publicId
  } else {
    const secret = generateWebhookSecret()
    const secretHash = await hashApiKey(secret)
    const [row] = await db
      .insert(webhooks)
      .values({
        url: input.url,
        eventType: input.eventType,
        secretHash,
        secretPrefix: secret.slice(0, 12),
        isActive: input.isActive,
        createdBy: adminId,
      })
      .returning({ publicId: webhooks.publicId })
    publicId = row.publicId
  }

  await writeAudit({
    actorId: adminId,
    action: 'admin_action',
    resourceType: 'user_account',
    metadata: { screen: 'S-6.7', action: 'save_webhook', publicId },
  })
  return { ok: true, publicId }
}

export async function deleteWebhookEndpointImpl(input: WebhookIdInput): Promise<{ ok: true }> {
  const adminId = await requireSettingsAdmin()

  await db
    .update(webhooks)
    .set({ deletedAt: new Date(), isActive: false })
    .where(eq(webhooks.publicId, input.publicId))

  await writeAudit({
    actorId: adminId,
    action: 'admin_action',
    resourceType: 'user_account',
    metadata: { screen: 'S-6.7', action: 'delete_webhook', publicId: input.publicId },
  })
  return { ok: true }
}

/**
 * Send Test Event (spec S-6.7): performs a real signed HTTPS POST and stores
 * the attempt in webhook_events. Status maps the HTTP response honestly —
 * no simulated success.
 */
export async function sendWebhookTestEventImpl(input: WebhookIdInput): Promise<WebhookTestResult> {
  const adminId = await requireSettingsAdmin()

  const rows = await db
    .select({
      publicId: webhooks.publicId,
      url: webhooks.url,
      eventType: webhooks.eventType,
      secretHash: webhooks.secretHash,
      isActive: webhooks.isActive,
    })
    .from(webhooks)
    .where(and(eq(webhooks.publicId, input.publicId), isNull(webhooks.deletedAt)))
    .limit(1)
  const endpoint = rows.at(0)
  if (!endpoint) throw new Error('WEBHOOK_NOT_FOUND')

  const payload = {
    id: crypto.randomUUID(),
    eventType: 'test.ping',
    endpoint: endpoint.eventType,
    sentBy: 'dashboard-settings',
    sentAt: new Date().toISOString(),
    data: { message: 'Test event from Abugida Settings (S-6.7)' },
  }
  const body = JSON.stringify(payload)
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = await signWebhookPayload(endpoint.secretHash, body, timestamp)

  let status: 'sent' | 'failed' = 'failed'
  let responseStatus: number | null = null
  let lastError: string | null = null
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS)
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-abugida-signature': `t=${timestamp},v1=${signature}`,
        },
        body,
        signal: controller.signal,
      })
      responseStatus = response.status
      status = response.ok ? 'sent' : 'failed'
      if (!response.ok) lastError = `HTTP ${response.status}`
    } finally {
      clearTimeout(timer)
    }
  } catch (cause) {
    status = 'failed'
    lastError = cause instanceof Error ? cause.message : 'Delivery failed'
  }

  const [event] = await db
    .insert(webhookEvents)
    .values({
      webhookUrl: endpoint.url,
      eventType: 'test.ping',
      payload,
      status,
      responseStatus,
      lastError,
      sentAt: status === 'sent' ? new Date() : null,
      retryCount: 0,
    })
    .returning({
      publicId: webhookEvents.publicId,
      eventType: webhookEvents.eventType,
      webhookUrl: webhookEvents.webhookUrl,
      status: webhookEvents.status,
      responseStatus: webhookEvents.responseStatus,
      lastError: webhookEvents.lastError,
      retryCount: webhookEvents.retryCount,
      createdAt: webhookEvents.createdAt,
    })
  await writeAudit({
    actorId: adminId,
    action: 'admin_action',
    resourceType: 'user_account',
    metadata: {
      screen: 'S-6.7',
      action: 'webhook_test_delivery',
      publicId: endpoint.publicId,
      deliveryStatus: status,
    },
  })

  return {
    delivery: {
      publicId: event.publicId,
      eventType: event.eventType,
      webhookUrl: event.webhookUrl,
      status: event.status,
      responseStatus: event.responseStatus,
      lastError: event.lastError,
      attemptCount: event.retryCount + 1,
      createdAt: event.createdAt.toISOString(),
    },
  }
}

/** Delivery log for one endpoint: webhook_events rows sharing its URL. */
export async function getWebhookDeliveriesImpl(input: {
  publicId: string
}): Promise<WebhookDeliveryItem[]> {
  await requireSettingsAdmin()

  const endpointRows = await db
    .select({ url: webhooks.url })
    .from(webhooks)
    .where(eq(webhooks.publicId, input.publicId))
    .limit(1)
  const url = endpointRows.at(0)?.url
  if (!url) throw new Error('WEBHOOK_NOT_FOUND')

  const rows = await db
    .select({
      publicId: webhookEvents.publicId,
      eventType: webhookEvents.eventType,
      webhookUrl: webhookEvents.webhookUrl,
      status: webhookEvents.status,
      responseStatus: webhookEvents.responseStatus,
      lastError: webhookEvents.lastError,
      retryCount: webhookEvents.retryCount,
      createdAt: webhookEvents.createdAt,
    })
    .from(webhookEvents)
    .where(sql`${webhookEvents.webhookUrl} = ${url}`)
    .orderBy(desc(webhookEvents.createdAt))
    .limit(MAX_DELIVERY_LOG)

  return rows.map((row) => ({
    publicId: row.publicId,
    eventType: row.eventType,
    webhookUrl: row.webhookUrl,
    status: row.status,
    responseStatus: row.responseStatus,
    lastError: row.lastError,
    attemptCount: row.retryCount + 1,
    createdAt: row.createdAt.toISOString(),
  }))
}
