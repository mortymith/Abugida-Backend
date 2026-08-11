import {
  pgTable,
  bigint,
  uuid,
  numeric,
  boolean,
  timestamp,
  integer,
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
import { courseBundles } from '../catalog/course-bundles'
import { purchases } from '../finance/purchases'
import { lessonCompletions } from './lesson-completions'
import { auditLogs } from '../ops/audit-logs'
export const enrollmentSourceEnum = z.enum([
  'purchase',
  'bundle_purchase',
  'free_access',
  'admin_grant',
  'preview',
])
export type EnrollmentSource = z.infer<typeof enrollmentSourceEnum>
export const enrollmentSourcePgEnum = pgEnum('enrollment_source', [
  'purchase',
  'bundle_purchase',
  'free_access',
  'admin_grant',
  'preview',
])
export const enrollments = pgTable(
  'enrollments',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    studentId: bigint('student_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    purchaseId: bigint('purchase_id', { mode: 'number' }).references(() => purchases.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    bundleId: bigint('bundle_id', { mode: 'number' }).references(() => courseBundles.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    enrollmentSource: enrollmentSourcePgEnum().default('purchase'),
    progressPercentage: numeric('progress_percentage', {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default('0'),
    isCompleted: boolean('is_completed').notNull().default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
    rowVersion: integer('row_version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_enrollments_public').on(table.publicId),
    uniqueIndex('idx_enrollments_unique').on(table.studentId, table.courseId),
    index('idx_enrollments_student_recent').on(table.studentId, table.lastAccessedAt),
    index('idx_enrollments_course_completion').on(table.courseId, table.isCompleted),
    index('idx_enrollments_purchase').on(table.purchaseId),
    index('idx_enrollments_bundle').on(table.bundleId),
    index('idx_enrollments_active')
      .on(table.studentId, table.lastAccessedAt)
      .where(sql`${table.deletedAt} IS NULL`),

    check(
      'progress_check',
      sql`${table.progressPercentage} >= 0 AND ${table.progressPercentage} <= 100`,
    ),
    check(
      'source_constraint',
      sql`(${table.enrollmentSource} = 'bundle_purchase' AND ${table.bundleId} IS NOT NULL AND ${table.purchaseId} IS NOT NULL) OR
        (${table.enrollmentSource} = 'purchase' AND ${table.purchaseId} IS NOT NULL) OR
        (${table.enrollmentSource} IN ('free_access', 'admin_grant', 'preview'))`,
    ),
  ],
)
export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  student: one(users, {
    fields: [enrollments.studentId],
    references: [users.id],
    relationName: 'student_enrollments',
  }),
  course: one(courses, {
    fields: [enrollments.courseId],
    references: [courses.id],
    relationName: 'course_enrollments',
  }),
  purchase: one(purchases, {
    fields: [enrollments.purchaseId],
    references: [purchases.id],
  }),
  bundle: one(courseBundles, {
    fields: [enrollments.bundleId],
    references: [courseBundles.id],
    relationName: 'bundle_enrollments',
  }),
  completions: many(lessonCompletions),
  auditLogs: many(auditLogs, {
    relationName: 'enrollment_audit_logs',
  }),
}))
export const insertEnrollmentSchema = createInsertSchema(enrollments, {
  studentId: z.number().positive(),
  courseId: z.number().positive(),
  purchaseId: z.number().positive().nullable().optional(),
  bundleId: z.number().positive().nullable().optional(),
  enrollmentSource: enrollmentSourceEnum.default('purchase'),
  progressPercentage: z.number().min(0).max(100).default(0),
  isCompleted: z.boolean().default(false),
  completedAt: z.date().nullable().optional(),
  lastAccessedAt: z.date().nullable().optional(),
  rowVersion: z.number().int().min(1).default(1),
}).omit({
  publicId: true,
})
export const selectEnrollmentSchema = createSelectSchema(enrollments)
export const updateEnrollmentSchema = insertEnrollmentSchema.partial()
export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>
export type SelectEnrollment = z.infer<typeof selectEnrollmentSchema>
export type UpdateEnrollment = z.infer<typeof updateEnrollmentSchema>
