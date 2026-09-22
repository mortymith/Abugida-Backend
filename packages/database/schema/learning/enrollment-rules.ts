import {
  bigint,
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  boolean,
  smallint,
  uniqueIndex,
  index,
  check,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'
import { courses } from '../catalog/courses'
import { cohorts } from './cohorts'

/**
 * Automated enrollment rules (spec 06 S-4.8): WHEN a trigger fires, enroll
 * the matching students into a target course. Fully auditable — every run
 * writes an `enrollment_rule_runs` row; enrollments are created exactly as
 * manual ones (source `admin_grant`).
 */
export const ruleTriggerEnum = z.enum([
  'course_completed',
  'tag_added',
  'cohort_assigned',
  'account_created',
])
export type RuleTrigger = z.infer<typeof ruleTriggerEnum>
export const ruleTriggerPgEnum = pgEnum('rule_trigger', [
  'course_completed',
  'tag_added',
  'cohort_assigned',
  'account_created',
])

export const ruleStatusEnum = z.enum(['draft', 'active', 'paused'])
export type RuleStatus = z.infer<typeof ruleStatusEnum>
export const ruleStatusPgEnum = pgEnum('rule_status', ['draft', 'active', 'paused'])

export const ruleRunKindEnum = z.enum(['event', 'sweep', 'manual', 'dry_run'])
export type RuleRunKind = z.infer<typeof ruleRunKindEnum>
export const ruleRunKindPgEnum = pgEnum('rule_run_kind', ['event', 'sweep', 'manual', 'dry_run'])

export const enrollmentRules = pgTable(
  'enrollment_rules',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    name: varchar('name', { length: 200 }).notNull(),
    triggerKind: ruleTriggerPgEnum().notNull(),
    /** course_completed trigger: the course whose completion fires the rule. */
    triggerCourseId: bigint('trigger_course_id', { mode: 'number' }).references(() => courses.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    /** tag_added trigger: the student tag to match. */
    triggerTag: varchar('trigger_tag', { length: 60 }),
    /** cohort_assigned trigger: the cohort whose membership fires the rule. */
    triggerCohortId: bigint('trigger_cohort_id', { mode: 'number' }).references(() => cohorts.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    /** Optional AND condition: min average quiz % in the trigger course. */
    minQuizAvgPercent: smallint('min_quiz_avg_percent'),
    targetCourseId: bigint('target_course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    sendWelcomeEmail: boolean('send_welcome_email').notNull().default(false),
    status: ruleStatusPgEnum().notNull().default('draft'),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_enrollment_rules_public').on(table.publicId),
    index('idx_enrollment_rules_status').on(table.status),
    // A rule cannot target its own trigger course (no self-enrollment loops).
    check(
      'rule_no_self_loop',
      sql`${table.triggerCourseId} IS NULL OR ${table.triggerCourseId} <> ${table.targetCourseId}`,
    ),
    check(
      'rule_trigger_payload',
      sql`(${table.triggerKind} = 'course_completed' AND ${table.triggerCourseId} IS NOT NULL) OR
        (${table.triggerKind} = 'tag_added' AND ${table.triggerTag} IS NOT NULL) OR
        (${table.triggerKind} = 'cohort_assigned' AND ${table.triggerCohortId} IS NOT NULL) OR
        (${table.triggerKind} = 'account_created')`,
    ),
  ],
)

export const enrollmentRuleRuns = pgTable(
  'enrollment_rule_runs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    ruleId: bigint('rule_id', { mode: 'number' })
      .notNull()
      .references(() => enrollmentRules.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    runKind: ruleRunKindPgEnum().notNull(),
    matched: bigint('matched', { mode: 'number' }).notNull().default(0),
    enrolled: bigint('enrolled', { mode: 'number' }).notNull().default(0),
    skipped: bigint('skipped', { mode: 'number' }).notNull().default(0),
    failed: bigint('failed', { mode: 'number' }).notNull().default(0),
    /** Sample of outcomes: { studentId, name, outcome, reason }. */
    details: jsonb('details'),
    ranAt: timestamp('ran_at', { withTimezone: true }).notNull().defaultNow(),
    ranBy: text('ran_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
  },
  (table) => [
    uniqueIndex('idx_enrollment_rule_runs_public').on(table.publicId),
    index('idx_enrollment_rule_runs_rule').on(table.ruleId, table.ranAt),
  ],
)

export const enrollmentRulesRelations = relations(enrollmentRules, ({ one, many }) => ({
  triggerCourse: one(courses, {
    fields: [enrollmentRules.triggerCourseId],
    references: [courses.id],
    relationName: 'rule_trigger_course',
  }),
  targetCourse: one(courses, {
    fields: [enrollmentRules.targetCourseId],
    references: [courses.id],
    relationName: 'rule_target_course',
  }),
  triggerCohort: one(cohorts, {
    fields: [enrollmentRules.triggerCohortId],
    references: [cohorts.id],
  }),
  runs: many(enrollmentRuleRuns),
}))

export const enrollmentRuleRunsRelations = relations(enrollmentRuleRuns, ({ one }) => ({
  rule: one(enrollmentRules, {
    fields: [enrollmentRuleRuns.ruleId],
    references: [enrollmentRules.id],
  }),
}))

export const insertEnrollmentRuleSchema = createInsertSchema(enrollmentRules, {
  name: z.string().trim().min(1).max(200),
  triggerTag: z.string().trim().min(1).max(60).nullable().optional(),
  minQuizAvgPercent: z.number().int().min(1).max(100).nullable().optional(),
}).omit({ publicId: true, createdAt: true, updatedAt: true, deletedAt: true })
export const selectEnrollmentRuleSchema = createSelectSchema(enrollmentRules)
export type InsertEnrollmentRule = z.infer<typeof insertEnrollmentRuleSchema>
export type SelectEnrollmentRule = z.infer<typeof selectEnrollmentRuleSchema>
