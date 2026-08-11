import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  smallint,
  integer,
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
import { courses } from './courses'
import { users } from '../auth/users'
import { lessons } from './lessons'
import { auditLogs } from '../ops/audit-logs'
export const modules = pgTable(
  'modules',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    instructorId: bigint('instructor_id', { mode: 'number' }).references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    title: varchar('title', { length: 300 }).notNull(),
    description: text('description'),
    sortOrder: smallint('sort_order').notNull(),
    estimatedDurationMinutes: integer('estimated_duration_minutes'),
    isPreviewAvailable: boolean('is_preview_available').notNull().default(false),
    rowVersion: integer('row_version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_modules_public').on(table.publicId),
    uniqueIndex('idx_modules_course_order').on(table.courseId, table.sortOrder),
    index('idx_modules_course').on(table.courseId),
    index('idx_modules_instructor').on(table.instructorId),
    index('idx_modules_course_active')
      .on(table.courseId, table.sortOrder)
      .where(sql`${table.deletedAt} IS NULL`),

    check('sort_order_check', sql`${table.sortOrder} >= 0`),
    check(
      'duration_check',
      sql`${table.estimatedDurationMinutes} > 0 OR ${table.estimatedDurationMinutes} IS NULL`,
    ),
  ],
)
export const modulesRelations = relations(modules, ({ one, many }) => ({
  course: one(courses, {
    fields: [modules.courseId],
    references: [courses.id],
  }),
  instructor: one(users, {
    fields: [modules.instructorId],
    references: [users.id],
    relationName: 'module_instructor',
  }),
  lessons: many(lessons),
  auditLogs: many(auditLogs, {
    relationName: 'module_audit_logs',
  }),
}))
export const insertModuleSchema = createInsertSchema(modules, {
  title: z.string().min(1).max(300),
  description: z.string().nullable().optional(),
  courseId: z.number().positive(),
  instructorId: z.number().positive().nullable().optional(),
  sortOrder: z.number().int().min(0),
  estimatedDurationMinutes: z.number().int().positive().nullable().optional(),
  isPreviewAvailable: z.boolean().default(false),
  rowVersion: z.number().int().min(1).default(1),
}).omit({
  publicId: true,
})
export const selectModuleSchema = createSelectSchema(modules)
export const updateModuleSchema = insertModuleSchema.partial()
export type InsertModule = z.infer<typeof insertModuleSchema>
export type SelectModule = z.infer<typeof selectModuleSchema>
export type UpdateModule = z.infer<typeof updateModuleSchema>
