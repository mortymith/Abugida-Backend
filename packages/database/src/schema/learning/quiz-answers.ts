import {
  pgTable,
  bigint,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { quizAttempts } from './quiz-attempts'
import { quizQuestions } from './quiz-questions'
import { quizAnswerHistory } from './quiz-answer-history'
export const quizAnswers = pgTable(
  'quiz_answers',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    quizAttemptId: bigint('quiz_attempt_id', { mode: 'number' })
      .notNull()
      .references(() => quizAttempts.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    questionId: bigint('question_id', { mode: 'number' })
      .notNull()
      .references(() => quizQuestions.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    studentAnswer: text('student_answer'),
    isCorrect: boolean('is_correct').notNull(),
    answeredAt: timestamp('answered_at', { withTimezone: true }).notNull(),
    rowVersion: integer('row_version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_quiz_answers_public').on(table.publicId),
    uniqueIndex('idx_quiz_answers_unique').on(table.quizAttemptId, table.questionId),
    index('idx_quiz_answers_attempt').on(table.quizAttemptId),
    index('idx_quiz_answers_question').on(table.questionId),
  ],
)
export const quizAnswersRelations = relations(quizAnswers, ({ one, many }) => ({
  attempt: one(quizAttempts, {
    fields: [quizAnswers.quizAttemptId],
    references: [quizAttempts.id],
  }),
  question: one(quizQuestions, {
    fields: [quizAnswers.questionId],
    references: [quizQuestions.id],
  }),
  history: many(quizAnswerHistory),
}))
export const insertQuizAnswerSchema = createInsertSchema(quizAnswers, {
  quizAttemptId: z.number().positive(),
  questionId: z.number().positive(),
  studentAnswer: z.string().nullable().optional(),
  isCorrect: z.boolean(),
  answeredAt: z.date(),
  rowVersion: z.number().int().min(1).default(1),
}).omit({
  publicId: true,
})
export const selectQuizAnswerSchema = createSelectSchema(quizAnswers)
export const updateQuizAnswerSchema = insertQuizAnswerSchema.partial()
export type InsertQuizAnswer = z.infer<typeof insertQuizAnswerSchema>
export type SelectQuizAnswer = z.infer<typeof selectQuizAnswerSchema>
export type UpdateQuizAnswer = z.infer<typeof updateQuizAnswerSchema>
