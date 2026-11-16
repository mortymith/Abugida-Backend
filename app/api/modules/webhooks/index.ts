/**
 * @module webhooks
 *
 * Webhooks feature module — incoming webhooks from payment providers and SMS service.
 *
 * Usage in app.ts:
 * ```ts
 * import { createWebhooksHandlers, createWebhooksRouteMap, createWebhooksRepository, createWebhooksService } from '#/modules/webhooks'
 *
 * const webhooksRepo = createWebhooksRepository(db)
 * const webhooksService = createWebhooksService(webhooksRepo, queue)
 * const webhooksHandlers = createWebhooksHandlers(webhooksService)
 * for (const { route, handler } of createWebhooksRouteMap(webhooksHandlers)) {
 *   app.openapi(route, handler)
 * }
 * ```
 */

export {
  handleTelebirrWebhookRoute,
  handleSmsDeliveryWebhookRoute,
} from '#/modules/webhooks/webhooks.routes'

export type {
  HandleTelebirrWebhookRoute,
  HandleSmsDeliveryWebhookRoute,
} from '#/modules/webhooks/webhooks.routes'

export {
  createWebhooksHandlers,
  createWebhooksRouteMap,
} from '#/modules/webhooks/webhooks.handlers'

export {
  createWebhooksRepository,
  type WebhooksRepository,
} from '#/modules/webhooks/webhooks.repository'

export {
  createWebhooksService,
  WebhookStorageError,
  type WebhooksService,
} from '#/modules/webhooks/webhooks.service'

export type {
  TelebirrWebhookBody,
  SmsDeliveryWebhookBody,
  WebhookProcessedResult,
} from '#/modules/webhooks/webhooks.types'
