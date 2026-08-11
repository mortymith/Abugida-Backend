import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  jsonb,
  smallint,
  timestamp,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

export const webhookEventStatusEnum = z.enum(['pending', 'sent', 'failed', 'retrying'])
export type WebhookEventStatus = z.infer<typeof webhookEventStatusEnum>
export const webhookEventStatusPgEnum = pgEnum('webhook_event_status', [
  'pending',
  'sent',
  'failed',
  'retrying',
])

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    webhookUrl: varchar('webhook_url', { length: 500 }).notNull(),
    eventType: varchar('event_type', { length: 200 }).notNull(),
    payload: jsonb('payload').notNull(),
    status: webhookEventStatusPgEnum().notNull().default('pending'),
    responseStatus: smallint('response_status'),
    responseBody: text('response_body'),
    retryCount: smallint('retry_count').notNull().default(0),
    maxRetries: smallint('max_retries').notNull().default(3),
    lastError: text('last_error'),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_webhook_events_public').on(table.publicId),
    index('idx_webhook_events_status_created').on(table.status, table.createdAt),
    index('idx_webhook_events_type').on(table.eventType),
    index('idx_webhook_events_next_retry').on(table.nextRetryAt),
  ],
)

export const insertWebhookEventSchema = createInsertSchema(webhookEvents, {
  webhookUrl: z.string().url().max(500),
  eventType: z.string().min(1).max(200),
  payload: z.record(z.string(), z.unknown()),
  status: webhookEventStatusEnum.default('pending'),
  responseStatus: z.number().int().nullable().optional(),
  responseBody: z.string().nullable().optional(),
  retryCount: z.number().int().min(0).default(0),
  maxRetries: z.number().int().min(0).max(10).default(3),
  lastError: z.string().nullable().optional(),
  nextRetryAt: z.date().nullable().optional(),
  sentAt: z.date().nullable().optional(),
}).omit({
  publicId: true,
})

export const selectWebhookEventSchema = createSelectSchema(webhookEvents)
export const updateWebhookEventSchema = insertWebhookEventSchema.partial()

export type InsertWebhookEvent = z.infer<typeof insertWebhookEventSchema>
export type SelectWebhookEvent = z.infer<typeof selectWebhookEventSchema>
export type UpdateWebhookEvent = z.infer<typeof updateWebhookEventSchema>
