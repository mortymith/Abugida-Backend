import {
  pgTable,
  bigint,
  uuid,
  smallint,
  boolean,
  timestamp,
  uniqueIndex,
  check,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { courses } from './courses'

export const completionRuleEnum = z.enum(['all_lessons', 'min_percent_quiz'])
export type CompletionRule = z.infer<typeof completionRuleEnum>
export const completionRulePgEnum = pgEnum('completion_rule_kind', [
  'all_lessons',
  'min_percent_quiz',
])

/**
 * What counts as "complete" for a course (spec 04 S-2.10): 100% of lessons,
 * or a minimum progress percentage plus a passing final-quiz score.
 * 1:1 with the course.
 */
export const completionRules = pgTable(
  'completion_rules',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .unique()
      .references(() => courses.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    rule: completionRulePgEnum().notNull().default('all_lessons'),
    minPercent: smallint('min_percent').notNull().default(80),
    autoIssue: boolean('auto_issue').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_completion_rules_public').on(table.publicId),
    check('min_percent_check', sql`${table.minPercent} BETWEEN 1 AND 100`),
  ],
)
export const completionRulesRelations = relations(completionRules, ({ one }) => ({
  course: one(courses, {
    fields: [completionRules.courseId],
    references: [courses.id],
  }),
}))
export const insertCompletionRuleSchema = createInsertSchema(completionRules, {
  courseId: z.number().positive(),
  rule: completionRuleEnum.default('all_lessons'),
  minPercent: z.number().int().min(1).max(100).default(80),
  autoIssue: z.boolean().default(true),
}).omit({
  publicId: true,
})
export const selectCompletionRuleSchema = createSelectSchema(completionRules)
export const updateCompletionRuleSchema = insertCompletionRuleSchema.partial()
export type InsertCompletionRule = z.infer<typeof insertCompletionRuleSchema>
export type SelectCompletionRule = z.infer<typeof selectCompletionRuleSchema>
export type UpdateCompletionRule = z.infer<typeof updateCompletionRuleSchema>
