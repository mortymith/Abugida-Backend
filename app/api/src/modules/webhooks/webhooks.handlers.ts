/**
 * @module webhooks.handlers
 *
 * Route handler implementations for the webhooks feature module.
 */

import type { Context } from 'hono'
import type { WebhooksService } from './webhooks.service'
import { WebhookStorageError, WebhookValidationError } from './webhooks.service'
import type { AppEnv } from '@/middleware/types'
import { problemResponse } from '@/middleware'

// ── Handlers ───────────────────────────────────────────────────────────────

export function createWebhooksHandlers(service: WebhooksService) {
  return {
    async handleTelebirrWebhook(c: Context<AppEnv>) {
      try {
        const payload = await c.req.json()
        const headers = Object.fromEntries(c.req.raw.headers.entries())
        const result = await service.handleTelebirrWebhook(payload, headers)
        return c.json(result, 200)
      } catch (error) {
        if (error instanceof WebhookValidationError)
          return problemResponse(c, { status: 400, detail: error.message })
        if (error instanceof WebhookStorageError)
          return problemResponse(c, { status: 500, detail: 'Failed to process webhook.' })
        if (error instanceof SyntaxError)
          return problemResponse(c, { status: 400, detail: 'Invalid JSON payload.' })
        throw error
      }
    },

    async handleSmsDeliveryWebhook(c: Context<AppEnv>) {
      try {
        const payload = await c.req.json()
        const headers = Object.fromEntries(c.req.raw.headers.entries())
        const result = await service.handleSmsDeliveryWebhook(payload, headers)
        return c.json(result, 200)
      } catch (error) {
        if (error instanceof WebhookStorageError)
          return problemResponse(c, { status: 500, detail: 'Failed to process webhook.' })
        if (error instanceof SyntaxError)
          return problemResponse(c, { status: 400, detail: 'Invalid JSON payload.' })
        throw error
      }
    },
  }
}

// ── Route-to-handler mapping ───────────────────────────────────────────────

import { handleTelebirrWebhookRoute, handleSmsDeliveryWebhookRoute } from './webhooks.routes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (c: any) => Promise<any>

export function createWebhooksRouteMap(handlers: ReturnType<typeof createWebhooksHandlers>) {
  return [
    {
      route: handleTelebirrWebhookRoute,
      handler: handlers.handleTelebirrWebhook as AnyHandler,
    },
    {
      route: handleSmsDeliveryWebhookRoute,
      handler: handlers.handleSmsDeliveryWebhook as AnyHandler,
    },
  ] as const
}
