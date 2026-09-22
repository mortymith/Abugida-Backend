import {
  pgTable,
  bigint,
  uuid,
  smallint,
  text,
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
import { lessons } from '../catalog/lessons'
import { quizAnswers } from './quiz-answers'
export const quizQuestions = pgTable(
  'quiz_questions',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    lessonId: bigint('lesson_id', { mode: 'number' })
      .notNull()
      .references(() => lessons.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    questionIndex: smallint('question_index').notNull(),
    questionText: text('question_text').notNull(),
    correctAnswer: text('correct_answer').notNull(),
    explanation: text('explanation'),
    rowVersion: integer('row_version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_quiz_questions_public').on(table.publicId),
    uniqueIndex('idx_quiz_questions_unique').on(table.lessonId, table.questionIndex),
    index('idx_quiz_questions_lesson').on(table.lessonId),

    check('question_index_check', sql`${table.questionIndex} >= 0`),
  ],
)
export const quizQuestionsRelations = relations(quizQuestions, ({ one, many }) => ({
  lesson: one(lessons, {
    fields: [quizQuestions.lessonId],
    references: [lessons.id],
  }),
  answers: many(quizAnswers),
}))
export const insertQuizQuestionSchema = createInsertSchema(quizQuestions, {
  lessonId: z.number().positive(),
  questionIndex: z.number().int().min(0),
  questionText: z.string().min(1),
  correctAnswer: z.string().min(1),
  explanation: z.string().nullable().optional(),
  rowVersion: z.number().int().min(1).default(1),
}).omit({
  publicId: true,
})
export const selectQuizQuestionSchema = createSelectSchema(quizQuestions)
export const updateQuizQuestionSchema = insertQuizQuestionSchema.partial()
export type InsertQuizQuestion = z.infer<typeof insertQuizQuestionSchema>
export type SelectQuizQuestion = z.infer<typeof selectQuizQuestionSchema>
export type UpdateQuizQuestion = z.infer<typeof updateQuizQuestionSchema>
