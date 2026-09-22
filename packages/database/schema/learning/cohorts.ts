import {
  bigint,
  pgTable,
  uuid,
  varchar,
  text,
  date,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'

import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'

/**
 * Student cohorts (spec 06 S-4.4): named student groups used for batch
 * enrollment, broadcast messaging, and progress tracking.
 */
export const cohorts = pgTable(
  'cohorts',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    startedAt: date('started_at'),
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
    uniqueIndex('idx_cohorts_public').on(table.publicId),
    index('idx_cohorts_name').on(table.name),
  ],
)

export const cohortMembers = pgTable(
  'cohort_members',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    cohortId: bigint('cohort_id', { mode: 'number' })
      .notNull()
      .references(() => cohorts.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    addedBy: text('added_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_cohort_members_unique').on(table.cohortId, table.studentId),
    index('idx_cohort_members_student').on(table.studentId),
  ],
)

export const cohortsRelations = relations(cohorts, ({ many }) => ({
  members: many(cohortMembers),
}))

export const cohortMembersRelations = relations(cohortMembers, ({ one }) => ({
  cohort: one(cohorts, {
    fields: [cohortMembers.cohortId],
    references: [cohorts.id],
  }),
  student: one(users, {
    fields: [cohortMembers.studentId],
    references: [users.id],
  }),
}))

export const insertCohortSchema = createInsertSchema(cohorts, {
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2_000).nullable().optional(),
  startedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
}).omit({ publicId: true, createdBy: true, createdAt: true, updatedAt: true, deletedAt: true })
export const selectCohortSchema = createSelectSchema(cohorts)
export type InsertCohort = z.infer<typeof insertCohortSchema>
export type SelectCohort = z.infer<typeof selectCohortSchema>
