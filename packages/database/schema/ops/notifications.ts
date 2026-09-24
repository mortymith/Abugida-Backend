import {
  pgTable,
  bigint,
  uuid,
  text,
  varchar,
  timestamp,
  uniqueIndex,
  index,
  check,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'

export const notificationTypeEnum = z.enum([
  'enrollment',
  'payment',
  'publish',
  'mention',
  'system',
  'team_invite',
  'review',
])
export type NotificationType = z.infer<typeof notificationTypeEnum>
export const notificationTypePgEnum = pgEnum('notification_type', [
  'enrollment',
  'payment',
  'publish',
  'mention',
  'system',
  'team_invite',
  'review',
])

/**
 * In-app notification center records (spec S-1.4). Rows are written by
 * producers (queue processors / service hooks); the dashboard only reads and
 * updates `readAt`. `linkEntityType` + `linkEntityPublicId` form the deep
 * link back to the source screen.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypePgEnum().notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body'),
    linkEntityType: varchar('link_entity_type', { length: 50 }),
    linkEntityPublicId: varchar('link_entity_public_id', { length: 100 }),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_notifications_public').on(table.publicId),
    index('idx_notifications_user_unread').on(table.userId, table.readAt),
    index('idx_notifications_user_recent').on(table.userId, table.createdAt),
    index('idx_notifications_user_type').on(table.userId, table.type),
    check(
      'notifications_link_check',
      sql`(${table.linkEntityType} IS NULL AND ${table.linkEntityPublicId} IS NULL) OR (${table.linkEntityType} IS NOT NULL AND ${table.linkEntityPublicId} IS NOT NULL)`,
    ),
  ],
)

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}))

export const insertNotificationSchema = createInsertSchema(notifications, {
  title: z.string().min(1).max(200),
  body: z.string().nullable().optional(),
  linkEntityType: z.string().max(50).nullable().optional(),
  linkEntityPublicId: z.string().max(100).nullable().optional(),
}).omit({
  publicId: true,
})
export const selectNotificationSchema = createSelectSchema(notifications)
export type InsertNotification = z.infer<typeof insertNotificationSchema>
export type SelectNotification = z.infer<typeof selectNotificationSchema>
