import {
  pgTable,
  bigint,
  uuid,
  text,
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
 * Which kind of subject a review request targets (spec 00 §2.6). `course` rows
 * carry `lessonId = NULL` and gate whole-course publication; `item` rows point
 * at a specific curriculum row via `lessonId`.
 */
export const reviewEntityTypeEnum = z.enum(['course', 'item'])
export type ReviewEntityType = z.infer<typeof reviewEntityTypeEnum>
export const reviewEntityTypePgEnum = pgEnum('review_entity_type', ['course', 'item'])

/**
 * Review & approval queue (spec 04 S-2.14). One open request per subject;
 * the lesson's `review_status` mirrors the latest decision so curriculum
 * rows can render status pills without joining this table everywhere.
 *
 * Revision 2 generalises the queue to cover both whole courses and individual
 * curriculum items. `entityType` discriminates the two: `item` rows populate
 * `lessonId`, `course` rows leave it NULL. Pre-existing rows are all lesson
 * requests, hence the `'item'` default on the column.
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
    /**
     * Target curriculum row. NULL for `entityType = 'course'`, required for
     * `entityType = 'item'` — enforced by `review_requests_subject_check`.
     */
    lessonId: bigint('lesson_id', { mode: 'number' }).references(() => lessons.id, {
      onDelete: 'restrict',
      onUpdate: 'cascade',
    }),
    entityType: reviewEntityTypePgEnum().notNull().default('item'),
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
    // Partial: course-level rows have lesson_id NULL, which btree indexes store
    // as a single shared NULL bucket, so an unfiltered index is useless for them.
    index('idx_review_requests_lesson')
      .on(table.lessonId)
      .where(sql`${table.lessonId} IS NOT NULL`),
    // Keeps the course-level queue (publish readiness) fast without letting
    // lesson-level rows dominate the index.
    index('idx_review_requests_open_course')
      .on(table.courseId, table.submittedAt)
      .where(sql`${table.entityType} = 'course' AND ${table.state} = 'pending'`),
    index('idx_review_requests_requested_by').on(table.requestedBy),

    check(
      'review_requests_subject_check',
      sql`(${table.entityType} = 'course' AND ${table.lessonId} IS NULL) OR (${table.entityType} = 'item' AND ${table.lessonId} IS NOT NULL)`,
    ),
  ],
)
export const reviewRequestsRelations = relations(reviewRequests, ({ one }) => ({
  course: one(courses, {
    fields: [reviewRequests.courseId],
    references: [courses.id],
  }),
  /** NULL for course-level requests; the `one` relation degrades to null. */
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
  /** Optional: omitted (or null) for course-level requests. */
  lessonId: z.number().positive().nullable().optional(),
  entityType: reviewEntityTypeEnum.default('item'),
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
