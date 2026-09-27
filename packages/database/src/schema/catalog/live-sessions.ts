import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  integer,
  boolean,
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
import { courses } from './courses'
import { lessons } from './lessons'
import { users } from '../auth/users'

export const sessionProviderEnum = z.enum(['zoom', 'google_meet', 'custom'])
export type SessionProvider = z.infer<typeof sessionProviderEnum>
export const sessionProviderPgEnum = pgEnum('session_provider', ['zoom', 'google_meet', 'custom'])
export const sessionStatusEnum = z.enum(['scheduled', 'completed', 'cancelled'])
export type SessionStatus = z.infer<typeof sessionStatusEnum>
export const sessionStatusPgEnum = pgEnum('session_status', ['scheduled', 'completed', 'cancelled'])

/**
 * Live session scheduler (spec 04 S-2.9) for courses with
 * `course_type = 'instructor_led'` (or hybrid). Conferencing provider and
 * join URL are stored here; OAuth link generation is an external integration
 * follow-up (documented in the PR).
 */
export const liveSessions = pgTable(
  'live_sessions',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    title: varchar('title', { length: 300 }).notNull(),
    description: text('description'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes'),
    hostId: text('host_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    provider: sessionProviderPgEnum().notNull().default('custom'),
    joinUrl: varchar('join_url', { length: 500 }),
    autoRecord: boolean('auto_record').notNull().default(false),
    recordingLessonId: bigint('recording_lesson_id', { mode: 'number' }).references(
      () => lessons.id,
      {
        onDelete: 'set null',
        onUpdate: 'cascade',
      },
    ),
    reminder24h: boolean('reminder_24h').notNull().default(true),
    reminder1h: boolean('reminder_1h').notNull().default(true),
    attendeeCount: integer('attendee_count').notNull().default(0),
    status: sessionStatusPgEnum().notNull().default('scheduled'),
    rowVersion: integer('row_version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_live_sessions_public').on(table.publicId),
    index('idx_live_sessions_course_time').on(table.courseId, table.scheduledAt),
    index('idx_live_sessions_host_time').on(table.hostId, table.scheduledAt),
    index('idx_live_sessions_status').on(table.status),

    check('attendee_count_check', sql`${table.attendeeCount} >= 0`),
    check('duration_check', sql`${table.durationMinutes} > 0 OR ${table.durationMinutes} IS NULL`),
  ],
)
export const liveSessionsRelations = relations(liveSessions, ({ one }) => ({
  course: one(courses, {
    fields: [liveSessions.courseId],
    references: [courses.id],
  }),
  host: one(users, {
    fields: [liveSessions.hostId],
    references: [users.id],
  }),
  recordingLesson: one(lessons, {
    fields: [liveSessions.recordingLessonId],
    references: [lessons.id],
  }),
}))
export const insertLiveSessionSchema = createInsertSchema(liveSessions, {
  title: z.string().min(1).max(300),
  scheduledAt: z.date(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  provider: sessionProviderEnum.default('custom'),
  joinUrl: z.string().max(500).nullable().optional(),
  attendeeCount: z.number().int().min(0).default(0),
  rowVersion: z.number().int().min(1).default(1),
}).omit({
  publicId: true,
})
export const selectLiveSessionSchema = createSelectSchema(liveSessions)
export const updateLiveSessionSchema = insertLiveSessionSchema.partial()
export type InsertLiveSession = z.infer<typeof insertLiveSessionSchema>
export type SelectLiveSession = z.infer<typeof selectLiveSessionSchema>
export type UpdateLiveSession = z.infer<typeof updateLiveSessionSchema>
