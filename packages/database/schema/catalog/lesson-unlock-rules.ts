import {
  pgTable,
  bigint,
  uuid,
  smallint,
  integer,
  text,
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

export const unlockConditionEnum = z.enum(['viewed', 'completed', 'quiz_score'])
export type UnlockCondition = z.infer<typeof unlockConditionEnum>
export const unlockConditionPgEnum = pgEnum('unlock_condition', [
  'viewed',
  'completed',
  'quiz_score',
])
export const lockBehaviorEnum = z.enum(['hidden', 'visible_locked'])
export type LockBehavior = z.infer<typeof lockBehaviorEnum>
export const lockBehaviorPgEnum = pgEnum('lock_behavior', ['hidden', 'visible_locked'])

/**
 * Prerequisites & unlock rules (spec 04 S-2.15). A rule locks `lessonId`
 * until `requiredLessonId` satisfies `condition`. Circular chains are blocked
 * in the application layer before save.
 */
export const lessonUnlockRules = pgTable(
  'lesson_unlock_rules',
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
    requiredLessonId: bigint('required_lesson_id', { mode: 'number' })
      .notNull()
      .references(() => lessons.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    condition: unlockConditionPgEnum().notNull().default('viewed'),
    thresholdPercent: smallint('threshold_percent'),
    lockBehavior: lockBehaviorPgEnum().notNull().default('visible_locked'),
    customMessage: text('custom_message'),
    rowVersion: integer('row_version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_lesson_unlock_rules_public').on(table.publicId),
    uniqueIndex('idx_lesson_unlock_rules_unique').on(table.lessonId, table.requiredLessonId),
    index('idx_lesson_unlock_rules_lesson').on(table.lessonId),
    index('idx_lesson_unlock_rules_course').on(table.courseId),

    check(
      'threshold_check',
      sql`${table.thresholdPercent} BETWEEN 1 AND 100 OR ${table.thresholdPercent} IS NULL`,
    ),
    check('no_self_reference', sql`${table.lessonId} <> ${table.requiredLessonId}`),
  ],
)
export const lessonUnlockRulesRelations = relations(lessonUnlockRules, ({ one }) => ({
  course: one(courses, {
    fields: [lessonUnlockRules.courseId],
    references: [courses.id],
  }),
  lesson: one(lessons, {
    fields: [lessonUnlockRules.lessonId],
    references: [lessons.id],
    relationName: 'unlock_rule_lesson',
  }),
  requiredLesson: one(lessons, {
    fields: [lessonUnlockRules.requiredLessonId],
    references: [lessons.id],
    relationName: 'unlock_rule_required_lesson',
  }),
}))
export const insertLessonUnlockRuleSchema = createInsertSchema(lessonUnlockRules, {
  courseId: z.number().positive(),
  lessonId: z.number().positive(),
  requiredLessonId: z.number().positive(),
  condition: unlockConditionEnum.default('viewed'),
  thresholdPercent: z.number().int().min(1).max(100).nullable().optional(),
  lockBehavior: lockBehaviorEnum.default('visible_locked'),
  customMessage: z.string().nullable().optional(),
  rowVersion: z.number().int().min(1).default(1),
}).omit({
  publicId: true,
})
export const selectLessonUnlockRuleSchema = createSelectSchema(lessonUnlockRules)
export const updateLessonUnlockRuleSchema = insertLessonUnlockRuleSchema.partial()
export type InsertLessonUnlockRule = z.infer<typeof insertLessonUnlockRuleSchema>
export type SelectLessonUnlockRule = z.infer<typeof selectLessonUnlockRuleSchema>
export type UpdateLessonUnlockRule = z.infer<typeof updateLessonUnlockRuleSchema>
