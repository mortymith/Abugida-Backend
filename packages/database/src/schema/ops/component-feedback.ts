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
import { users } from '../auth/users'

/**
 * Component feedback (spec 09 § S-7.3 / S-7.4 / S-7.11). The 👍/👎
 * one-field feedback form on empty states, help articles, and the
 * readiness checklist posts here. Lightweight: one row per submission,
 * tagged with the screen ID and component ID so feedback is attributable
 * to a specific surface variant.
 */
export const componentFeedback = pgTable(
  'component_feedback',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    /** e.g. 'S-2.17', 'S-7.3' */
    screenId: varchar('screen_id', { length: 100 }).notNull(),
    /** e.g. 'S-7.3', 'S-7.11' */
    componentId: varchar('component_id', { length: 100 }).notNull(),
    /** e.g. 'multi-action', 'standard' */
    variant: varchar('variant', { length: 100 }),
    /** true = 👍, false = 👎 */
    rating: boolean('rating').notNull(),
    /** Optional one-field textarea */
    comment: text('comment'),
    /** Who submitted, if authenticated */
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_component_feedback_public').on(table.publicId),
    index('idx_component_feedback_screen_component').on(table.screenId, table.componentId),
    index('idx_component_feedback_created').on(table.createdAt),
  ],
)

export const componentFeedbackRelations = relations(componentFeedback, ({ one }) => ({
  user: one(users, {
    fields: [componentFeedback.userId],
    references: [users.id],
    relationName: 'component_feedback_user',
  }),
}))

export const insertComponentFeedbackSchema = createInsertSchema(componentFeedback, {
  screenId: z.string().trim().min(1).max(100),
  componentId: z.string().trim().min(1).max(100),
  variant: z.string().max(100).nullable().optional(),
  rating: z.boolean(),
  comment: z.string().nullable().optional(),
}).omit({ publicId: true })
export const selectComponentFeedbackSchema = createSelectSchema(componentFeedback)
export type InsertComponentFeedback = z.infer<typeof insertComponentFeedbackSchema>
export type SelectComponentFeedback = z.infer<typeof selectComponentFeedbackSchema>
