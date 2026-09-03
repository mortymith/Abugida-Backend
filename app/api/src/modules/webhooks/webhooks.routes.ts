/**
 * @module webhooks.routes
 *
 * OpenAPI route definitions for the webhooks feature module.
 */

import { createRoute } from '@hono/zod-openapi'
import {
  BadRequestSchema,
  UnauthorizedSchema,
  ForbiddenSchema,
  ConflictSchema,
  UnprocessableEntitySchema,
  TooManyRequestsSchema,
  InternalServerErrorSchema,
  TelebirrWebhookPayloadSchema,
  SmsDeliveryWebhookPayloadSchema,
  WebhookProcessedResponseSchema,
} from './webhooks.schemas'

// ── POST /webhooks/telebirr ────────────────────────────────────────────────

export const handleTelebirrWebhookRoute = createRoute({
  method: 'post',
  path: '/webhooks/telebirr',
  tags: ['Webhooks'],
  summary: 'Telebirr C2B payment callback',
  description:
    'Receives payment callback from Telebirr C2B service. ' +
    'Sole payment method — all platforms. ' +
    'Stores in ops.webhook_events (provider=telebirr) and enqueues async processing.',
  operationId: 'handleTelebirrWebhook',
  security: [{ apiKeyHeader: [] }],
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: TelebirrWebhookPayloadSchema } },
    },
  },
  responses: {
    200: {
      description: 'Webhook processed',
      content: { 'application/json': { schema: WebhookProcessedResponseSchema } },
    },
    400: {
      description: 'Invalid webhook payload',
      content: { 'application/problem+json': { schema: BadRequestSchema } },
    },
    401: {
      description: 'Unauthorized — invalid or missing API key',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    403: {
      description: 'Forbidden — API key lacks webhook scope',
      content: { 'application/problem+json': { schema: ForbiddenSchema } },
    },
    409: {
      description: 'Duplicate webhook (idempotency key already processed)',
      content: { 'application/problem+json': { schema: ConflictSchema } },
    },
    422: {
      description: 'Unprocessable Entity',
      content: { 'application/problem+json': { schema: UnprocessableEntitySchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
    500: {
      description: 'Internal Server Error',
      content: { 'application/problem+json': { schema: InternalServerErrorSchema } },
    },
  },
})

export type HandleTelebirrWebhookRoute = typeof handleTelebirrWebhookRoute

// ── POST /webhooks/sms-delivery ────────────────────────────────────────────

export const handleSmsDeliveryWebhookRoute = createRoute({
  method: 'post',
  path: '/webhooks/sms-delivery',
  tags: ['Webhooks'],
  summary: 'SMS delivery status callback',
  description:
    'Receives delivery status from SMSEthiopia. ' +
    'Stores in ops.webhook_events. ' +
    'Note: ops.webhook_events.provider enum must include smsethiopia.',
  operationId: 'handleSmsDeliveryWebhook',
  security: [{ apiKeyHeader: [] }],
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: SmsDeliveryWebhookPayloadSchema } },
    },
  },
  responses: {
    200: {
      description: 'Webhook processed',
      content: { 'application/json': { schema: WebhookProcessedResponseSchema } },
    },
    400: {
      description: 'Invalid webhook payload',
      content: { 'application/problem+json': { schema: BadRequestSchema } },
    },
    401: {
      description: 'Unauthorized — invalid or missing API key',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    403: {
      description: 'Forbidden — API key lacks webhook scope',
      content: { 'application/problem+json': { schema: ForbiddenSchema } },
    },
    409: {
      description: 'Duplicate webhook',
      content: { 'application/problem+json': { schema: ConflictSchema } },
    },
    422: {
      description: 'Unprocessable Entity',
      content: { 'application/problem+json': { schema: UnprocessableEntitySchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
    500: {
      description: 'Internal Server Error',
      content: { 'application/problem+json': { schema: InternalServerErrorSchema } },
    },
  },
})

export type HandleSmsDeliveryWebhookRoute = typeof handleSmsDeliveryWebhookRoute
