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
import { liveSessions } from '../catalog/live-sessions'
import { users } from '../auth/users'

/**
 * Per-student attendance record for a live session (spec 04 S-2.9 →
 * _Live Session Scheduler_, manual attendance fallback).
 *
 * `source = 'provider'` rows are written by the provider integration (Zoom /
 * Google Meet) when available; `source = 'manual'` rows are written by an
 * Admin/Editor using the manual attendance fallback UI. A manual row never
 * overwrites a provider row without confirmation — the provider row is the
 * source of truth when both exist.
 */
export const attendanceStatusEnum = z.enum(['present', 'late', 'absent'])
export type AttendanceStatus = z.infer<typeof attendanceStatusEnum>
export const attendanceStatusPgEnum = pgEnum('attendance_status', ['present', 'late', 'absent'])

export const attendanceSourceEnum = z.enum(['provider', 'manual'])
export type AttendanceSource = z.infer<typeof attendanceSourceEnum>
export const attendanceSourcePgEnum = pgEnum('attendance_source', ['provider', 'manual'])

export const sessionAttendance = pgTable(
  'session_attendance',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    sessionId: bigint('session_id', { mode: 'number' })
      .notNull()
      .references(() => liveSessions.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    status: attendanceStatusPgEnum().notNull(),
    source: attendanceSourcePgEnum().notNull().default('manual'),
    markedBy: text('marked_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    markedAt: timestamp('marked_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_session_attendance_public').on(table.publicId),
    uniqueIndex('idx_session_attendance_session_user').on(table.sessionId, table.userId),
    index('idx_session_attendance_session').on(table.sessionId),
    index('idx_session_attendance_user').on(table.userId),
    index('idx_session_attendance_status').on(table.sessionId, table.status),
  ],
)

export const sessionAttendanceRelations = relations(sessionAttendance, ({ one }) => ({
  session: one(liveSessions, {
    fields: [sessionAttendance.sessionId],
    references: [liveSessions.id],
  }),
  user: one(users, {
    fields: [sessionAttendance.userId],
    references: [users.id],
    relationName: 'session_attendance_user',
  }),
  marker: one(users, {
    fields: [sessionAttendance.markedBy],
    references: [users.id],
    relationName: 'session_attendance_marker',
  }),
}))

export const insertSessionAttendanceSchema = createInsertSchema(sessionAttendance, {
  sessionId: z.number().positive(),
  userId: z.string().min(1),
  status: attendanceStatusEnum,
  source: attendanceSourceEnum.default('manual'),
  markedBy: z.string().nullable().optional(),
}).omit({
  publicId: true,
})
export const selectSessionAttendanceSchema = createSelectSchema(sessionAttendance)
export const updateSessionAttendanceSchema = insertSessionAttendanceSchema.partial()
export type InsertSessionAttendance = z.infer<typeof insertSessionAttendanceSchema>
export type SelectSessionAttendance = z.infer<typeof selectSessionAttendanceSchema>
export type UpdateSessionAttendance = z.infer<typeof updateSessionAttendanceSchema>
