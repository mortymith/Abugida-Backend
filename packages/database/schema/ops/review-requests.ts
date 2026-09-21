import {
  pgTable,
  bigint,
  uuid,
  text,
  timestamp,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { courses } from '../catalog/courses'
import { lessons } from '../catalog/lessons'
import { users } from '../auth/users'

export const reviewStateEnum = z.enum(['pending', 'changes_requested', 'approved', 'rejected'])
export type ReviewState = z.infer<typeof reviewStateEnum>
export const reviewStatePgEnum = pgEnum('review_state', [
  'pending',
  'changes_requested',
  'approved',
  'rejected',
])

/**
 * Review & approval queue (spec 04 S-2.14). One open request per lesson;
 * the lesson's `review_status` mirrors the latest decision so curriculum
 * rows can render status pills without joining this table everywhere.
 */
export const reviewRequests = pgTable(
  'review_requests',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    lessonId: bigint('lesson_id', { mode: 'number' })
      .notNull()
      .references(() => lessons.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    requestedBy: text('requested_by')
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    decidedBy: text('decided_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    state: reviewStatePgEnum().notNull().default('pending'),
    submissionNote: text('submission_note'),
    decisionComment: text('decision_comment'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_review_requests_public').on(table.publicId),
    index('idx_review_requests_state').on(table.state, table.submittedAt),
    index('idx_review_requests_course').on(table.courseId),
    index('idx_review_requests_lesson').on(table.lessonId),
    index('idx_review_requests_requested_by').on(table.requestedBy),
  ],
)
export const reviewRequestsRelations = relations(reviewRequests, ({ one }) => ({
  course: one(courses, {
    fields: [reviewRequests.courseId],
    references: [courses.id],
  }),
  lesson: one(lessons, {
    fields: [reviewRequests.lessonId],
    references: [lessons.id],
  }),
  requester: one(users, {
    fields: [reviewRequests.requestedBy],
    references: [users.id],
    relationName: 'review_requester',
  }),
  decider: one(users, {
    fields: [reviewRequests.decidedBy],
    references: [users.id],
    relationName: 'review_decider',
  }),
}))
export const insertReviewRequestSchema = createInsertSchema(reviewRequests, {
  courseId: z.number().positive(),
  lessonId: z.number().positive(),
  requestedBy: z.string().min(1),
  state: reviewStateEnum.default('pending'),
  submissionNote: z.string().nullable().optional(),
  decisionComment: z.string().nullable().optional(),
}).omit({
  publicId: true,
})
export const selectReviewRequestSchema = createSelectSchema(reviewRequests)
export const updateReviewRequestSchema = insertReviewRequestSchema.partial()
export type InsertReviewRequest = z.infer<typeof insertReviewRequestSchema>
export type SelectReviewRequest = z.infer<typeof selectReviewRequestSchema>
export type UpdateReviewRequest = z.infer<typeof updateReviewRequestSchema>
