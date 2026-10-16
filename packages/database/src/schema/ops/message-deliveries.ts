import {
  bigint,
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'
import { messageThreads, messages } from './messaging'

/**
 * Per-recipient per-channel message delivery state (spec 06 S-4.5 — "A
 * delivery is a row, not a boolean on the message").
 *
 * A message to one recipient creates up to 3 delivery rows (in_app,
 * telegram, email). Each row tracks its own state independently:
 * `pending → delivered → read` or `pending → failed`.
 *
 * The 7-day dormancy rule (spec S-4.5): a message is relayed over Telegram
 * only when the student has not opened the app in 7 days AND has a verified
 * Telegram handle. The relay creates a `telegram` delivery row, not a
 * separate message. Email follows the same dormancy rule, gated on a
 * verified email address.
 *
 * Read receipts are per-channel: a message delivered over Telegram and
 * read in-app reads "Read" once, with the channel noted — not two receipts.
 */
export const messageDeliveryChannelEnum = z.enum(['in_app', 'telegram', 'email'])
export type MessageDeliveryChannel = z.infer<typeof messageDeliveryChannelEnum>
export const messageDeliveryChannelPgEnum = pgEnum('message_delivery_channel', [
  'in_app',
  'telegram',
  'email',
])

export const messageDeliveryStateEnum = z.enum(['pending', 'delivered', 'read', 'failed'])
export type MessageDeliveryState = z.infer<typeof messageDeliveryStateEnum>
export const messageDeliveryStatePgEnum = pgEnum('message_delivery_state', [
  'pending',
  'delivered',
  'read',
  'failed',
])

export const messageDeliveries = pgTable(
  'message_deliveries',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    messageId: bigint('message_id', { mode: 'number' })
      .notNull()
      .references(() => messages.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    threadId: bigint('thread_id', { mode: 'number' })
      .notNull()
      .references(() => messageThreads.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    recipientId: text('recipient_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    channel: messageDeliveryChannelPgEnum().notNull(),
    state: messageDeliveryStatePgEnum().notNull().default('pending'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    /** Failure reason for `failed` state (e.g. "no_verified_contact", "provider_error"). */
    failureReason: varchar('failure_reason', { length: 200 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_message_deliveries_public').on(table.publicId),
    /** One delivery row per (message, recipient, channel). */
    uniqueIndex('idx_message_deliveries_message_recipient_channel').on(
      table.messageId,
      table.recipientId,
      table.channel,
    ),
    index('idx_message_deliveries_message').on(table.messageId),
    index('idx_message_deliveries_recipient').on(table.recipientId, table.state),
    index('idx_message_deliveries_thread').on(table.threadId, table.state),
    /** Partial index for the pending-delivery sweep worker. */
    index('idx_message_deliveries_pending')
      .on(table.createdAt)
      .where(sql`${table.state} = 'pending'`),
  ],
)

export const messageDeliveriesRelations = relations(messageDeliveries, ({ one }) => ({
  message: one(messages, {
    fields: [messageDeliveries.messageId],
    references: [messages.id],
  }),
  thread: one(messageThreads, {
    fields: [messageDeliveries.threadId],
    references: [messageThreads.id],
  }),
  recipient: one(users, {
    fields: [messageDeliveries.recipientId],
    references: [users.id],
    relationName: 'message_delivery_recipient',
  }),
}))

export const insertMessageDeliverySchema = createInsertSchema(messageDeliveries, {
  messageId: z.number().positive(),
  threadId: z.number().positive(),
  recipientId: z.string().min(1),
  channel: messageDeliveryChannelEnum,
  state: messageDeliveryStateEnum.default('pending'),
  failureReason: z.string().max(200).nullable().optional(),
}).omit({
  publicId: true,
})
export const selectMessageDeliverySchema = createSelectSchema(messageDeliveries)
export const updateMessageDeliverySchema = insertMessageDeliverySchema.partial()
export type InsertMessageDelivery = z.infer<typeof insertMessageDeliverySchema>
export type SelectMessageDelivery = z.infer<typeof selectMessageDeliverySchema>
export type UpdateMessageDelivery = z.infer<typeof updateMessageDeliverySchema>
