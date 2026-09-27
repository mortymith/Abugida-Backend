import {
  bigint,
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'
import { courses } from '../catalog/courses'

/**
 * Enrollment requests and waitlists (spec 06 S-4.6): learner-side requests
 * for approval-gated courses (`courses.requires_approval`), managed from the
 * dashboard. Approving creates a real enrollment (source `admin_grant`).
 */
export const requestStateEnum = z.enum(['pending', 'approved', 'denied'])
export type RequestState = z.infer<typeof requestStateEnum>
export const requestStatePgEnum = pgEnum('enrollment_request_state', [
  'pending',
  'approved',
  'denied',
])

export const waitlistStateEnum = z.enum(['waiting', 'promoted', 'left'])
export type WaitlistState = z.infer<typeof waitlistStateEnum>
export const waitlistStatePgEnum = pgEnum('waitlist_state', ['waiting', 'promoted', 'left'])

export const enrollmentRequests = pgTable(
  'enrollment_requests',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    status: requestStatePgEnum().notNull().default('pending'),
    note: text('note'),
    decidedBy: text('decided_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    decisionNote: varchar('decision_note', { length: 500 }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_enrollment_requests_public').on(table.publicId),
    uniqueIndex('idx_enrollment_requests_open_unique')
      .on(table.studentId, table.courseId)
      .where(sql`${table.status} = 'pending'`),
    index('idx_enrollment_requests_status').on(table.status, table.createdAt),
    index('idx_enrollment_requests_course').on(table.courseId),
  ],
)

export const waitlistEntries = pgTable(
  'waitlist_entries',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    position: bigint('position', { mode: 'number' }).notNull(),
    status: waitlistStatePgEnum().notNull().default('waiting'),
    promotedAt: timestamp('promoted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_waitlist_entries_public').on(table.publicId),
    uniqueIndex('idx_waitlist_entries_waiting_unique')
      .on(table.courseId, table.studentId)
      .where(sql`${table.status} = 'waiting'`),
    index('idx_waitlist_entries_queue').on(table.courseId, table.status, table.position),
  ],
)

export const enrollmentRequestsRelations = relations(enrollmentRequests, ({ one }) => ({
  student: one(users, {
    fields: [enrollmentRequests.studentId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [enrollmentRequests.courseId],
    references: [courses.id],
  }),
}))

export const waitlistEntriesRelations = relations(waitlistEntries, ({ one }) => ({
  course: one(courses, {
    fields: [waitlistEntries.courseId],
    references: [courses.id],
  }),
  student: one(users, {
    fields: [waitlistEntries.studentId],
    references: [users.id],
  }),
}))

export const insertEnrollmentRequestSchema = createInsertSchema(enrollmentRequests, {
  note: z.string().trim().max(2_000).nullable().optional(),
}).omit({ publicId: true, createdAt: true, updatedAt: true })
export const selectEnrollmentRequestSchema = createSelectSchema(enrollmentRequests)
export type InsertEnrollmentRequest = z.infer<typeof insertEnrollmentRequestSchema>
export type SelectEnrollmentRequest = z.infer<typeof selectEnrollmentRequestSchema>
