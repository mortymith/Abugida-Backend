import {
  pgTable,
  bigint,
  uuid,
  varchar,
  smallint,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { courses } from './courses'
import { lessons } from './lessons'
import { quizOptions } from './quiz-options'
import { quizQuestions } from '../learning/quiz-questions'

/**
 * Quiz-level settings (spec 04 S-2.8). A quiz configures scoring, timing and
 * attempt policy for the questions attached to a lesson; 1:1 with the lesson
 * (existing `quiz_questions` rows are lesson-scoped). Options for multiple
 * choice questions live in `quiz_options`.
 */
export const quizzes = pgTable(
  'quizzes',
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
    title: varchar('title', { length: 300 }).notNull(),
    passingScorePercent: smallint('passing_score_percent').notNull().default(70),
    timeLimitMinutes: integer('time_limit_minutes'),
    maxAttempts: smallint('max_attempts'),
    isPublished: boolean('is_published').notNull().default(false),
    rowVersion: integer('row_version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_quizzes_public').on(table.publicId),
    uniqueIndex('idx_quizzes_lesson').on(table.lessonId),
    index('idx_quizzes_course').on(table.courseId),

    check('passing_score_check', sql`${table.passingScorePercent} BETWEEN 1 AND 100`),
    check(
      'time_limit_check',
      sql`${table.timeLimitMinutes} > 0 OR ${table.timeLimitMinutes} IS NULL`,
    ),
    check('max_attempts_check', sql`${table.maxAttempts} > 0 OR ${table.maxAttempts} IS NULL`),
  ],
)
export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  course: one(courses, {
    fields: [quizzes.courseId],
    references: [courses.id],
  }),
  lesson: one(lessons, {
    fields: [quizzes.lessonId],
    references: [lessons.id],
  }),
  questions: many(quizQuestions),
  options: many(quizOptions),
}))
export const insertQuizSchema = createInsertSchema(quizzes, {
  title: z.string().min(1).max(300),
  passingScorePercent: z.number().int().min(1).max(100).default(70),
  timeLimitMinutes: z.number().int().positive().nullable().optional(),
  maxAttempts: z.number().int().positive().nullable().optional(),
  isPublished: z.boolean().default(false),
  rowVersion: z.number().int().min(1).default(1),
}).omit({
  publicId: true,
})
export const selectQuizSchema = createSelectSchema(quizzes)
export const updateQuizSchema = insertQuizSchema.partial()
export type InsertQuiz = z.infer<typeof insertQuizSchema>
export type SelectQuiz = z.infer<typeof selectQuizSchema>
export type UpdateQuiz = z.infer<typeof updateQuizSchema>
