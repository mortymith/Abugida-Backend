import {
  pgTable,
  bigint,
  uuid,
  boolean,
  timestamp,
  integer,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'
import { lessons } from '../catalog/lessons'
import { enrollments } from './enrollments'
export const lessonCompletions = pgTable(
  'lesson_completions',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    studentId: bigint('student_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    lessonId: bigint('lesson_id', { mode: 'number' })
      .notNull()
      .references(() => lessons.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    enrollmentId: bigint('enrollment_id', { mode: 'number' })
      .notNull()
      .references(() => enrollments.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    isCompleted: boolean('is_completed').notNull().default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    timeSpentSeconds: integer('time_spent_seconds'),
    rowVersion: integer('row_version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_lesson_completions_public').on(table.publicId),
    uniqueIndex('idx_lesson_completions_unique').on(table.studentId, table.lessonId),
    index('idx_lesson_completions_enrollment').on(table.enrollmentId),
    index('idx_lesson_completions_lesson').on(table.lessonId),
    index('idx_lesson_completions_progress').on(table.enrollmentId, table.isCompleted),
    index('idx_lesson_completions_incomplete')
      .on(table.enrollmentId, table.isCompleted)
      .where(sql`is_completed = false`),

    check(
      'time_spent_check',
      sql`${table.timeSpentSeconds} >= 0 OR ${table.timeSpentSeconds} IS NULL`,
    ),
  ],
)
export const lessonCompletionsRelations = relations(lessonCompletions, ({ one }) => ({
  student: one(users, {
    fields: [lessonCompletions.studentId],
    references: [users.id],
  }),
  lesson: one(lessons, {
    fields: [lessonCompletions.lessonId],
    references: [lessons.id],
  }),
  enrollment: one(enrollments, {
    fields: [lessonCompletions.enrollmentId],
    references: [enrollments.id],
  }),
}))
export const insertLessonCompletionSchema = createInsertSchema(lessonCompletions, {
  studentId: z.number().positive(),
  lessonId: z.number().positive(),
  enrollmentId: z.number().positive(),
  isCompleted: z.boolean().default(false),
  completedAt: z.date().nullable().optional(),
  timeSpentSeconds: z.number().int().min(0).nullable().optional(),
  rowVersion: z.number().int().min(1).default(1),
}).omit({
  publicId: true,
})
export const selectLessonCompletionSchema = createSelectSchema(lessonCompletions)
export const updateLessonCompletionSchema = insertLessonCompletionSchema.partial()
export type InsertLessonCompletion = z.infer<typeof insertLessonCompletionSchema>
export type SelectLessonCompletion = z.infer<typeof selectLessonCompletionSchema>
export type UpdateLessonCompletion = z.infer<typeof updateLessonCompletionSchema>
