import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

/**
 * Outbound webhook endpoint registry (spec 08 S-6.7 "API & Webhooks").
 * Delivery attempts are recorded per endpoint in ops.webhook_events, keyed
 * by the endpoint's URL. Secrets are stored hashed — the plaintext signing
 * secret is shown once at creation, mirroring the API-key contract.
 */
export const webhooks = pgTable(
  'webhooks',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    url: varchar('url', { length: 500 }).notNull(),
    eventType: varchar('event_type', { length: 200 }).notNull(),
    secretHash: varchar('secret_hash', { length: 128 }).notNull(),
    secretPrefix: varchar('secret_prefix', { length: 12 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_webhooks_public').on(table.publicId),
    index('idx_webhooks_url').on(table.url),
    index('idx_webhooks_active').on(table.isActive),
  ],
)

export const webhooksRelations = relations(webhooks, ({ one }) => ({
  creator: one(usersRef, {
    fields: [webhooks.createdBy],
    references: [usersRef.id],
  }),
}))

// Local import placed after usage only for typing; see file bottom.
import { users as usersRef } from '../auth/users'

export const insertWebhookSchema = createInsertSchema(webhooks, {
  url: z.string().url().max(500),
  eventType: z.string().min(1).max(200),
  secretHash: z.string().min(1).max(128),
  secretPrefix: z.string().min(1).max(12),
  isActive: z.boolean().default(true),
  createdBy: z.string().nullable().optional(),
}).omit({
  publicId: true,
})

export const selectWebhookSchema = createSelectSchema(webhooks)
export type InsertWebhook = z.infer<typeof insertWebhookSchema>
export type SelectWebhook = z.infer<typeof selectWebhookSchema>
