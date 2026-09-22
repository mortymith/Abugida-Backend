import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type {
  ApiKeyCreated,
  ApiKeyItem,
  WebhookDeliveryItem,
  WebhookEndpointItem,
  WebhookTestResult,
} from '../settings.types'
import {
  apiKeyIdSchema,
  createApiKeySchema,
  saveWebhookEndpointSchema,
  webhookIdSchema,
} from '../schemas/settings.schema'

const deliveryQuerySchema = z.object({ publicId: z.string().uuid() })

/**
 * Client-safe S-6.7 API & Webhooks server functions. Key plaintexts are
 * returned exactly once at creation; webhook test deliveries are performed
 * server-side and recorded in webhook_events.
 */

export const getApiKeys = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ApiKeyItem[]> => {
    const { getApiKeysImpl } = await import('./settings.api-webhooks.impl.server')
    return getApiKeysImpl()
  },
)

export const createApiKey = createServerFn({ method: 'POST' })
  .validator((input: unknown) => createApiKeySchema.parse(input))
  .handler(async ({ data }): Promise<ApiKeyCreated> => {
    const { createApiKeyImpl } = await import('./settings.api-webhooks.impl.server')
    return createApiKeyImpl(data)
  })

export const revokeApiKey = createServerFn({ method: 'POST' })
  .validator((input: unknown) => apiKeyIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { revokeApiKeyImpl } = await import('./settings.api-webhooks.impl.server')
    return revokeApiKeyImpl(data)
  })

export const getWebhookEndpoints = createServerFn({ method: 'GET' }).handler(
  async (): Promise<WebhookEndpointItem[]> => {
    const { getWebhookEndpointsImpl } = await import('./settings.api-webhooks.impl.server')
    return getWebhookEndpointsImpl()
  },
)

export const saveWebhookEndpoint = createServerFn({ method: 'POST' })
  .validator((input: unknown) => saveWebhookEndpointSchema.parse(input))
  .handler(async ({ data }) => {
    const { saveWebhookEndpointImpl } = await import('./settings.api-webhooks.impl.server')
    return saveWebhookEndpointImpl(data)
  })

export const deleteWebhookEndpoint = createServerFn({ method: 'POST' })
  .validator((input: unknown) => webhookIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { deleteWebhookEndpointImpl } = await import('./settings.api-webhooks.impl.server')
    return deleteWebhookEndpointImpl(data)
  })

export const sendWebhookTestEvent = createServerFn({ method: 'POST' })
  .validator((input: unknown) => webhookIdSchema.parse(input))
  .handler(async ({ data }): Promise<WebhookTestResult> => {
    const { sendWebhookTestEventImpl } = await import('./settings.api-webhooks.impl.server')
    return sendWebhookTestEventImpl(data)
  })

export const getWebhookDeliveries = createServerFn({ method: 'POST' })
  .validator((input: unknown) => deliveryQuerySchema.parse(input))
  .handler(async ({ data }): Promise<WebhookDeliveryItem[]> => {
    const { getWebhookDeliveriesImpl } = await import('./settings.api-webhooks.impl.server')
    return getWebhookDeliveriesImpl(data)
  })
