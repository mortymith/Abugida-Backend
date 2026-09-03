/**
 * @module webhooks
 *
 * Webhooks feature module — incoming webhooks from payment providers and SMS service.
 *
 * Usage in app.ts:
 * ```ts
 * import { createWebhooksHandlers, createWebhooksRouteMap, createWebhooksRepository, createWebhooksService } from './modules/webhooks'
 *
 * const webhooksRepo = createWebhooksRepository(db)
 * const webhooksService = createWebhooksService(webhooksRepo, queue)
 * const webhooksHandlers = createWebhooksHandlers(webhooksService)
 * for (const { route, handler } of createWebhooksRouteMap(webhooksHandlers)) {
 *   app.openapi(route, handler)
 * }
 * ```
 */

export { handleTelebirrWebhookRoute, handleSmsDeliveryWebhookRoute } from './webhooks.routes'

export type { HandleTelebirrWebhookRoute, HandleSmsDeliveryWebhookRoute } from './webhooks.routes'

export { createWebhooksHandlers, createWebhooksRouteMap } from './webhooks.handlers'

export { createWebhooksRepository, type WebhooksRepository } from './webhooks.repository'

export {
  createWebhooksService,
  WebhookStorageError,
  type WebhooksService,
} from './webhooks.service'

export type {
  TelebirrWebhookBody,
  SmsDeliveryWebhookBody,
  WebhookProcessedResult,
} from './webhooks.types'
