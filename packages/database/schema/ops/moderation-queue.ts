import {
  pgTable,
  bigint,
  uuid,
  text,
  jsonb,
  smallint,
  timestamp,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'

export const moderationQueueStatusEnum = z.enum(['pending', 'approved', 'rejected', 'escalated'])
export type ModerationQueueStatus = z.infer<typeof moderationQueueStatusEnum>
export const moderationQueueStatusPgEnum = pgEnum('moderation_status', [
  'pending',
  'approved',
  'rejected',
  'escalated',
])

export const moderationTargetTypeEnum = z.enum([
  'review',
  'course_content',
  'user_profile',
  'quiz_answer',
])
export type ModerationTargetType = z.infer<typeof moderationTargetTypeEnum>
export const moderationTargetTypePgEnum = pgEnum('moderation_target_type', [
  'review',
  'course_content',
  'user_profile',
  'quiz_answer',
])

export const moderationQueue = pgTable(
  'moderation_queue',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    targetType: moderationTargetTypePgEnum().notNull(),
    targetId: bigint('target_id', { mode: 'number' }).notNull(),
    submittedBy: bigint('submitted_by', { mode: 'number' })
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    reviewedBy: bigint('reviewed_by', { mode: 'number' }).references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    status: moderationQueueStatusPgEnum().notNull().default('pending'),
    priority: smallint('priority').notNull().default(0),
    reason: text('reason'),
    reviewerNotes: text('reviewer_notes'),
    metadata: jsonb('metadata').notNull().default({}),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_moderation_queue_public').on(table.publicId),
    index('idx_moderation_queue_status_priority').on(table.status, table.priority),
    index('idx_moderation_queue_target').on(table.targetType, table.targetId),
    index('idx_moderation_queue_submitted').on(table.submittedBy),
    index('idx_moderation_queue_reviewed').on(table.reviewedBy),
  ],
)

export const moderationQueueRelations = relations(moderationQueue, ({ one }) => ({
  submitter: one(users, {
    fields: [moderationQueue.submittedBy],
    references: [users.id],
    relationName: 'moderation_submitter',
  }),
  reviewer: one(users, {
    fields: [moderationQueue.reviewedBy],
    references: [users.id],
    relationName: 'moderation_reviewer',
  }),
}))

export const insertModerationQueueSchema = createInsertSchema(moderationQueue, {
  targetType: moderationTargetTypeEnum,
  targetId: z.number().positive(),
  submittedBy: z.number().positive(),
  reviewedBy: z.number().positive().nullable().optional(),
  status: moderationQueueStatusEnum.default('pending'),
  priority: z.number().int().min(0).default(0),
  reason: z.string().nullable().optional(),
  reviewerNotes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  submittedAt: z.date().nullable().optional(),
  reviewedAt: z.date().nullable().optional(),
}).omit({
  publicId: true,
})

export const selectModerationQueueSchema = createSelectSchema(moderationQueue)
export const updateModerationQueueSchema = insertModerationQueueSchema.partial()

export type InsertModerationQueue = z.infer<typeof insertModerationQueueSchema>
export type SelectModerationQueue = z.infer<typeof selectModerationQueueSchema>
export type UpdateModerationQueue = z.infer<typeof updateModerationQueueSchema>
