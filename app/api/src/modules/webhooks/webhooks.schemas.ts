/**
 * @module webhooks.schemas
 *
 * Zod schemas for the webhooks feature module.
 */

import { z } from '@hono/zod-openapi'

// ── Shared error schemas ───────────────────────────────────────────────────

export const ProblemDetailSchema = z
  .object({
    type: z.string().url(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    instance: z.string(),
    correlationId: z.string().uuid().optional(),
  })
  .openapi('ProblemDetail')

export const BadRequestSchema = ProblemDetailSchema.extend({
  status: z.literal(400),
}).openapi('BadRequest')

export const UnauthorizedSchema = ProblemDetailSchema.extend({
  status: z.literal(401),
}).openapi('Unauthorized')

export const ForbiddenSchema = ProblemDetailSchema.extend({
  status: z.literal(403),
}).openapi('Forbidden')

export const ConflictSchema = ProblemDetailSchema.extend({
  status: z.literal(409),
}).openapi('Conflict')

export const UnprocessableEntitySchema = ProblemDetailSchema.extend({
  status: z.literal(422),
}).openapi('UnprocessableEntity')

export const TooManyRequestsSchema = ProblemDetailSchema.extend({
  status: z.literal(429),
}).openapi('TooManyRequests')

export const InternalServerErrorSchema = ProblemDetailSchema.extend({
  status: z.literal(500),
}).openapi('InternalServerError')

// ── Telebirr webhook payload ───────────────────────────────────────────────

export const TelebirrWebhookPayloadSchema = z
  .object({
    externalTransactionId: z
      .string()
      .describe('Maps to purchase_transactions.external_transaction_id'),
    merchantCode: z.string().describe('Stored in validation_response jsonb'),
    transactionId: z.string().describe('Telebirr transaction ID (stored in validation_response)'),
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,4})?$/)
      .describe('Maps to purchase_transactions.amount'),
    currency: z.string().describe('Maps to purchase_transactions.currency'),
    status: z.string().describe('Telebirr status. Mapped: SUCCESS→succeeded, FAILED→failed'),
    paymentTime: z.string().datetime().describe('Maps to purchases.completed_at'),
    subscriberNumber: z.string().describe('PII — stored encrypted in validation_response'),
  })
  .openapi('TelebirrWebhookPayload')

// ── SMS delivery webhook payload ───────────────────────────────────────────

export const SmsDeliveryWebhookPayloadSchema = z
  .object({
    messageId: z.string(),
    status: z.enum(['DELIVERED', 'FAILED', 'EXPIRED', 'UNKNOWN']),
    deliveredAt: z.string().datetime().optional(),
    errorCode: z.string().optional(),
    errorMessage: z.string().optional(),
  })
  .openapi('SmsDeliveryWebhookPayload')

// ── Webhook processed response ─────────────────────────────────────────────

export const WebhookProcessedResponseSchema = z
  .object({
    received: z.boolean(),
    eventId: z.string().uuid(),
  })
  .openapi('WebhookProcessedResponse')
