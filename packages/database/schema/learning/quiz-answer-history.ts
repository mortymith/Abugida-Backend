import {
  pgTable,
  bigint,
  uuid,
  text,
  boolean,
  timestamp,
  varchar,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { quizAnswers } from './quiz-answers'
import { users } from '../auth/users'
export const quizAnswerHistory = pgTable(
  'quiz_answer_history',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    quizAnswerId: bigint('quiz_answer_id', { mode: 'number' })
      .notNull()
      .references(() => quizAnswers.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    oldIsCorrect: boolean('old_is_correct'),
    newIsCorrect: boolean('new_is_correct'),
    oldStudentAnswer: text('old_student_answer'),
    newStudentAnswer: text('new_student_answer'),
    changedBy: bigint('changed_by', { mode: 'number' })
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    changeReason: varchar('change_reason', { length: 200 }),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_quiz_answer_history_public').on(table.publicId),
    index('idx_qah_answer_time').on(table.quizAnswerId, table.changedAt),
    index('idx_qah_changed_by').on(table.changedBy, table.changedAt),
    index('idx_qah_time').on(table.changedAt),
  ],
)
export const quizAnswerHistoryRelations = relations(quizAnswerHistory, ({ one }) => ({
  answer: one(quizAnswers, {
    fields: [quizAnswerHistory.quizAnswerId],
    references: [quizAnswers.id],
  }),
  changer: one(users, {
    fields: [quizAnswerHistory.changedBy],
    references: [users.id],
  }),
}))
export const insertQuizAnswerHistorySchema = createInsertSchema(quizAnswerHistory, {
  quizAnswerId: z.number().positive(),
  oldIsCorrect: z.boolean().nullable().optional(),
  newIsCorrect: z.boolean().nullable().optional(),
  oldStudentAnswer: z.string().nullable().optional(),
  newStudentAnswer: z.string().nullable().optional(),
  changedBy: z.number().positive(),
  changeReason: z.string().max(200).nullable().optional(),
}).omit({
  publicId: true,
})
export const selectQuizAnswerHistorySchema = createSelectSchema(quizAnswerHistory)
export type InsertQuizAnswerHistory = z.infer<typeof insertQuizAnswerHistorySchema>
export type SelectQuizAnswerHistory = z.infer<typeof selectQuizAnswerHistorySchema>
