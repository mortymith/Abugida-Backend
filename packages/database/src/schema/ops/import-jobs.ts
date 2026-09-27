import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { courses } from '../catalog/courses'
import { users } from '../auth/users'

export const importJobStatusEnum = z.enum(['completed', 'undone', 'failed'])
export type ImportJobStatus = z.infer<typeof importJobStatusEnum>
export const importJobStatusPgEnum = pgEnum('import_job_status', ['completed', 'undone', 'failed'])

/**
 * Bulk module & lesson import jobs (spec 04 S-2.13). `createdIds` records
 * every module/lesson the run created so "Undo import" (30-minute window)
 * removes exactly those rows. Modules/lessons carry `source: import` via
 * their tags.
 */
export const importJobs = pgTable(
  'import_jobs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    courseId: bigint('course_id', { mode: 'number' }).references(() => courses.id, {
      onDelete: 'restrict',
      onUpdate: 'cascade',
    }),
    fileName: varchar('file_name', { length: 300 }).notNull(),
    mapping: jsonb('mapping').notNull().default({}),
    stats: jsonb('stats').notNull().default({}),
    createdIds: jsonb('created_ids').notNull().default({}),
    status: importJobStatusPgEnum().notNull().default('completed'),
    error: text('error'),
    undoExpiresAt: timestamp('undo_expires_at', { withTimezone: true }),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_import_jobs_public').on(table.publicId),
    index('idx_import_jobs_course').on(table.courseId),
    index('idx_import_jobs_created_by').on(table.createdBy),
  ],
)
export const importJobsRelations = relations(importJobs, ({ one }) => ({
  course: one(courses, {
    fields: [importJobs.courseId],
    references: [courses.id],
  }),
  creator: one(users, {
    fields: [importJobs.createdBy],
    references: [users.id],
  }),
}))
export const insertImportJobSchema = createInsertSchema(importJobs, {
  fileName: z.string().min(1).max(300),
  mapping: z.record(z.string(), z.unknown()).default({}),
  stats: z.record(z.string(), z.unknown()).default({}),
  createdIds: z.record(z.string(), z.unknown()).default({}),
  status: importJobStatusEnum.default('completed'),
  undoExpiresAt: z.date().nullable().optional(),
  createdBy: z.string().nullable().optional(),
}).omit({
  publicId: true,
})
export const selectImportJobSchema = createSelectSchema(importJobs)
export type InsertImportJob = z.infer<typeof insertImportJobSchema>
export type SelectImportJob = z.infer<typeof selectImportJobSchema>
