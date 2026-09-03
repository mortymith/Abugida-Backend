/**
 * @module webhooks.handlers
 *
 * Route handler implementations for the webhooks feature module.
 */

import type { Context } from 'hono'
import type { WebhooksService } from './webhooks.service'
import { WebhookStorageError } from './webhooks.service'
import type { AppEnv } from '@/middleware/types'

// ── Helpers ────────────────────────────────────────────────────────────────

function badRequest(c: Context<AppEnv>, detail: string) {
  return c.json(
    {
      type: 'https://api.abugida.com/errors/invalid-parameter',
      title: 'Invalid Parameter',
      status: 400,
      detail,
      instance: c.req.path,
    } as const,
    400,
  )
}

function internalError(c: Context<AppEnv>, detail: string) {
  return c.json(
    {
      type: 'https://api.abugida.com/errors/internal',
      title: 'Internal Server Error',
      status: 500,
      detail,
      instance: c.req.path,
    } as const,
    500,
  )
}

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
        if (error instanceof WebhookStorageError)
          return internalError(c, 'Failed to process webhook.')
        if (error instanceof SyntaxError) return badRequest(c, 'Invalid JSON payload.')
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
          return internalError(c, 'Failed to process webhook.')
        if (error instanceof SyntaxError) return badRequest(c, 'Invalid JSON payload.')
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
