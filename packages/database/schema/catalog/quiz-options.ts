import {
  pgTable,
  bigint,
  uuid,
  smallint,
  text,
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
import { quizQuestions } from '../learning/quiz-questions'

/**
 * Multiple-choice options for a quiz question (spec 04 S-2.8). Free-text /
 * short-answer questions keep using `quiz_questions.correct_answer` directly.
 * Exactly one option per question must be marked correct — enforced in the
 * application layer (partial unique index cannot express the "exactly one"
 * rule portably across soft-deleted rows).
 */
export const quizOptions = pgTable(
  'quiz_options',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    questionId: bigint('question_id', { mode: 'number' })
      .notNull()
      .references(() => quizQuestions.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    optionIndex: smallint('option_index').notNull(),
    optionText: text('option_text').notNull(),
    isCorrect: boolean('is_correct').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_quiz_options_public').on(table.publicId),
    uniqueIndex('idx_quiz_options_order').on(table.questionId, table.optionIndex),
    index('idx_quiz_options_question').on(table.questionId),

    check('option_index_check', sql`${table.optionIndex} >= 0`),
  ],
)
export const quizOptionsRelations = relations(quizOptions, ({ one }) => ({
  question: one(quizQuestions, {
    fields: [quizOptions.questionId],
    references: [quizQuestions.id],
  }),
}))
export const insertQuizOptionSchema = createInsertSchema(quizOptions, {
  questionId: z.number().positive(),
  optionIndex: z.number().int().min(0),
  optionText: z.string().min(1),
  isCorrect: z.boolean().default(false),
}).omit({
  publicId: true,
})
export const selectQuizOptionSchema = createSelectSchema(quizOptions)
export const updateQuizOptionSchema = insertQuizOptionSchema.partial()
export type InsertQuizOption = z.infer<typeof insertQuizOptionSchema>
export type SelectQuizOption = z.infer<typeof selectQuizOptionSchema>
export type UpdateQuizOption = z.infer<typeof updateQuizOptionSchema>
