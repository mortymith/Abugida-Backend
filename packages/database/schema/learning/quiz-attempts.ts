import {
  pgTable,
  bigint,
  uuid,
  smallint,
  numeric,
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
import { quizAnswers } from './quiz-answers'
import { auditLogs } from '../ops/audit-logs'
export const quizAttempts = pgTable(
  'quiz_attempts',
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
    attemptNumber: smallint('attempt_number').notNull(),
    totalQuestions: smallint('total_questions').notNull(),
    correctAnswers: smallint('correct_answers').notNull(),
    quizScorePercentage: numeric('quiz_score_percentage', {
      precision: 5,
      scale: 2,
    }).notNull(),
    isPassed: boolean('is_passed').notNull(),
    durationSeconds: integer('duration_seconds'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    rowVersion: integer('row_version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_quiz_attempts_public').on(table.publicId),
    index('idx_quiz_attempts_student_lesson').on(table.studentId, table.lessonId),
    index('idx_quiz_attempts_student_time').on(table.studentId, table.createdAt),
    index('idx_quiz_attempts_lesson_pass').on(table.lessonId, table.isPassed),
    index('idx_quiz_attempts_history').on(table.studentId, table.lessonId, table.completedAt),

    check('attempt_number_check', sql`${table.attemptNumber} >= 1`),
    check('total_questions_check', sql`${table.totalQuestions} > 0`),
    check(
      'correct_answers_check',
      sql`${table.correctAnswers} >= 0 AND ${table.correctAnswers} <= ${table.totalQuestions}`,
    ),
    check(
      'score_check',
      sql`${table.quizScorePercentage} >= 0 AND ${table.quizScorePercentage} <= 100`,
    ),
    check('duration_check', sql`${table.durationSeconds} >= 0 OR ${table.durationSeconds} IS NULL`),
  ],
)
export const quizAttemptsRelations = relations(quizAttempts, ({ one, many }) => ({
  student: one(users, {
    fields: [quizAttempts.studentId],
    references: [users.id],
  }),
  lesson: one(lessons, {
    fields: [quizAttempts.lessonId],
    references: [lessons.id],
  }),
  answers: many(quizAnswers),
  auditLogs: many(auditLogs, {
    relationName: 'quiz_audit_logs',
  }),
}))
export const insertQuizAttemptSchema = createInsertSchema(quizAttempts, {
  studentId: z.number().positive(),
  lessonId: z.number().positive(),
  attemptNumber: z.number().int().min(1),
  totalQuestions: z.number().int().positive(),
  correctAnswers: z.number().int().min(0),
  quizScorePercentage: z.number().min(0).max(100),
  isPassed: z.boolean(),
  durationSeconds: z.number().int().min(0).nullable().optional(),
  startedAt: z.date(),
  completedAt: z.date().nullable().optional(),
  rowVersion: z.number().int().min(1).default(1),
}).omit({
  publicId: true,
})
export const selectQuizAttemptSchema = createSelectSchema(quizAttempts)
export const updateQuizAttemptSchema = insertQuizAttemptSchema.partial()
export type InsertQuizAttempt = z.infer<typeof insertQuizAttemptSchema>
export type SelectQuizAttempt = z.infer<typeof selectQuizAttemptSchema>
export type UpdateQuizAttempt = z.infer<typeof updateQuizAttemptSchema>
