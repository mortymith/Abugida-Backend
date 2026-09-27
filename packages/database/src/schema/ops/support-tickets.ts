import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  timestamp,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'

/**
 * Support tickets raised from the in-app Help & Support panel (spec 09
 * S-7.4). Submissions auto-attach the screen the reporter was on
 * (`current_screen`) so support reproduces issues in context. Tickets are
 * soft-deleted only; status transitions are operational, not user-facing.
 */
export const supportTicketStatusEnum = pgEnum('support_ticket_status', [
  'open',
  'in_progress',
  'resolved',
])
export type SupportTicketStatus = z.infer<typeof supportTicketStatusEnum>

export const supportTicketCategoryEnum = pgEnum('support_ticket_category', [
  'question',
  'bug',
  'billing',
  'other',
])
export type SupportTicketCategory = z.infer<typeof supportTicketCategoryEnum>

export const supportTickets = pgTable(
  'support_tickets',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    category: supportTicketCategoryEnum().notNull().default('question'),
    subject: varchar('subject', { length: 200 }).notNull(),
    message: text('message').notNull(),
    /** Route path of the screen the reporter submitted from (auto-attached). */
    currentScreen: varchar('current_screen', { length: 300 }),
    status: supportTicketStatusEnum().notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_support_tickets_public').on(table.publicId),
    index('idx_support_tickets_user').on(table.userId),
    index('idx_support_tickets_status').on(table.status),
  ],
)

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  user: one(users, {
    fields: [supportTickets.userId],
    references: [users.id],
  }),
}))

export const insertSupportTicketSchema = createInsertSchema(supportTickets, {
  category: z.enum(['question', 'bug', 'billing', 'other']).default('question'),
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(10).max(5000),
  currentScreen: z.string().trim().max(300).nullable().optional(),
  status: z.enum(['open', 'in_progress', 'resolved']).default('open'),
}).omit({
  publicId: true,
})

export const selectSupportTicketSchema = createSelectSchema(supportTickets)
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>
export type SelectSupportTicket = z.infer<typeof selectSupportTicketSchema>
