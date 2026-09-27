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

export const outboxEventStatusEnum = z.enum(['pending', 'processing', 'completed', 'failed'])
export type OutboxEventStatus = z.infer<typeof outboxEventStatusEnum>
export const outboxEventStatusPgEnum = pgEnum('outbox_event_status', [
  'pending',
  'processing',
  'completed',
  'failed',
])

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    aggregateType: varchar('aggregate_type', { length: 100 }).notNull(),
    aggregateId: varchar('aggregate_id', { length: 255 }).notNull(),
    eventType: varchar('event_type', { length: 200 }).notNull(),
    payload: jsonb('payload').notNull(),
    status: outboxEventStatusPgEnum().notNull().default('pending'),
    retryCount: smallint('retry_count').notNull().default(0),
    maxRetries: smallint('max_retries').notNull().default(3),
    lastError: text('last_error'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_outbox_events_public').on(table.publicId),
    index('idx_outbox_events_status_created').on(table.status, table.createdAt),
    index('idx_outbox_events_aggregate').on(table.aggregateType, table.aggregateId),
    index('idx_outbox_events_type').on(table.eventType),
  ],
)

export const insertOutboxEventSchema = createInsertSchema(outboxEvents, {
  aggregateType: z.string().min(1).max(100),
  aggregateId: z.string().min(1).max(255),
  eventType: z.string().min(1).max(200),
  payload: z.record(z.string(), z.unknown()),
  status: outboxEventStatusEnum.default('pending'),
  retryCount: z.number().int().min(0).default(0),
  maxRetries: z.number().int().min(0).max(10).default(3),
  lastError: z.string().nullable().optional(),
  processedAt: z.date().nullable().optional(),
}).omit({
  publicId: true,
})

export const selectOutboxEventSchema = createSelectSchema(outboxEvents)
export const updateOutboxEventSchema = insertOutboxEventSchema.partial()

export type InsertOutboxEvent = z.infer<typeof insertOutboxEventSchema>
export type SelectOutboxEvent = z.infer<typeof selectOutboxEventSchema>
export type UpdateOutboxEvent = z.infer<typeof updateOutboxEventSchema>
