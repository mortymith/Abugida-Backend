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
import { users } from '../auth/users'

/**
 * Waitlist for at-capacity courses (spec 04 S-2.18 → _Students_ tab,
 * spec 06 S-4.6).
 *
 * Lifecycle: `waiting → offered → enrolled` (happy path) or
 * `waiting → expired` (offer lapsed) or `waiting → cancelled` (student
 * withdrew from the waitlist). An `offered` row has `expiresAt` set; the
 * enrolment worker transitions `offered → expired` past the deadline.
 */
export const waitlistStatusEnum = z.enum(['waiting', 'offered', 'enrolled', 'expired', 'cancelled'])
export type WaitlistStatus = z.infer<typeof waitlistStatusEnum>
export const waitlistStatusPgEnum = pgEnum('waitlist_status', [
  'waiting',
  'offered',
  'enrolled',
  'expired',
  'cancelled',
])

export const waitlists = pgTable(
  'waitlists',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    status: waitlistStatusPgEnum().notNull().default('waiting'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    offeredAt: timestamp('offered_at', { withTimezone: true }),
    /** Set when `status` flips to `offered`; the worker reads this to expire. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_waitlists_public').on(table.publicId),
    // A user is on a course's waitlist at most once at a time.
    uniqueIndex('idx_waitlists_course_user_active').on(table.courseId, table.userId, table.status),
    index('idx_waitlists_course').on(table.courseId),
    index('idx_waitlists_user').on(table.userId),
    index('idx_waitlists_status').on(table.courseId, table.status),
    index('idx_waitlists_offered_expires')
      .on(table.expiresAt)
      .where(sql`${table.status} = 'offered'`),
    check(
      'waitlists_offered_has_expires',
      sql`(${table.status} = 'offered' AND ${table.offeredAt} IS NOT NULL AND ${table.expiresAt} IS NOT NULL) OR ${table.status} <> 'offered'`,
    ),
    check(
      'waitlists_enrolled_has_enrolled_at',
      sql`(${table.status} = 'enrolled' AND ${table.enrolledAt} IS NOT NULL) OR ${table.status} <> 'enrolled'`,
    ),
  ],
)

export const waitlistsRelations = relations(waitlists, ({ one }) => ({
  course: one(courses, {
    fields: [waitlists.courseId],
    references: [courses.id],
  }),
  user: one(users, {
    fields: [waitlists.userId],
    references: [users.id],
    relationName: 'waitlist_user',
  }),
}))

export const insertWaitlistSchema = createInsertSchema(waitlists, {
  courseId: z.number().positive(),
  userId: z.string().min(1),
  status: waitlistStatusEnum.default('waiting'),
}).omit({
  publicId: true,
})
export const selectWaitlistSchema = createSelectSchema(waitlists)
export const updateWaitlistSchema = insertWaitlistSchema.partial()
export type InsertWaitlist = z.infer<typeof insertWaitlistSchema>
export type SelectWaitlist = z.infer<typeof selectWaitlistSchema>
export type UpdateWaitlist = z.infer<typeof updateWaitlistSchema>
