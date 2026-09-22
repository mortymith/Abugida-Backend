import {
  bigint,
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'

/**
 * Staff ↔ student messaging (spec 06 S-4.5): threaded one-to-one
 * conversations plus broadcast fan-out to cohorts. Broadcast messages
 * create one thread per recipient sharing a `broadcast_group_id`.
 */
export const threadKindEnum = z.enum(['direct', 'broadcast'])
export type ThreadKind = z.infer<typeof threadKindEnum>
export const threadKindPgEnum = pgEnum('message_thread_kind', ['direct', 'broadcast'])

/** Attachment references — lesson/course/asset entity links or external URLs. */
export const messageAttachmentSchema = z
  .object({
    kind: z.enum(['lesson', 'course', 'asset', 'link']),
    label: z.string().trim().min(1).max(200),
    /** Entity public id for lesson/course/asset kinds. */
    entityPublicId: z.string().uuid().optional(),
    /** Absolute URL for `link` kind. */
    url: z.string().url().max(2_000).optional(),
  })
  .strict()
export type MessageAttachment = z.infer<typeof messageAttachmentSchema>

export const messageThreads = pgTable(
  'message_threads',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    /** Staff participant who owns the conversation on the dashboard side. */
    staffId: text('staff_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    kind: threadKindPgEnum().notNull().default('direct'),
    subject: varchar('subject', { length: 200 }),
    /** Groups the per-recipient threads created by one broadcast. */
    broadcastGroupId: uuid('broadcast_group_id'),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
    lastMessagePreview: varchar('last_message_preview', { length: 200 }),
    unreadStaffCount: integer('unread_staff_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_message_threads_public').on(table.publicId),
    index('idx_message_threads_staff_recent').on(table.staffId, table.lastMessageAt),
    index('idx_message_threads_student').on(table.studentId, table.lastMessageAt),
    index('idx_message_threads_broadcast').on(table.broadcastGroupId),
  ],
)

export const messages = pgTable(
  'messages',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    threadId: bigint('thread_id', { mode: 'number' })
      .notNull()
      .references(() => messageThreads.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    senderId: text('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    body: text('body').notNull(),
    attachments: jsonb('attachments').$type<MessageAttachment[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_messages_public').on(table.publicId),
    index('idx_messages_thread_recent').on(table.threadId, table.createdAt),
  ],
)

export const messageThreadsRelations = relations(messageThreads, ({ one, many }) => ({
  student: one(users, {
    fields: [messageThreads.studentId],
    references: [users.id],
    relationName: 'thread_student',
  }),
  staff: one(users, {
    fields: [messageThreads.staffId],
    references: [users.id],
    relationName: 'thread_staff',
  }),
  messages: many(messages),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  thread: one(messageThreads, {
    fields: [messages.threadId],
    references: [messageThreads.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}))

export const insertMessageThreadSchema = createInsertSchema(messageThreads, {
  subject: z.string().trim().max(200).nullable().optional(),
}).omit({ publicId: true, createdAt: true, updatedAt: true })
export const selectMessageThreadSchema = createSelectSchema(messageThreads)
export type InsertMessageThread = z.infer<typeof insertMessageThreadSchema>
export type SelectMessageThread = z.infer<typeof selectMessageThreadSchema>
