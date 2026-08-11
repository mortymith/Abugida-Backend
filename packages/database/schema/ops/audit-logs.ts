import {
  pgTable,
  bigint,
  uuid,
  jsonb,
  timestamp,
  inet,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'
import { courses } from '../catalog/courses'
import { modules } from '../catalog/modules'
import { lessons } from '../catalog/lessons'
import { enrollments } from '../learning/enrollments'
import { quizAttempts } from '../learning/quiz-attempts'
import { purchases } from '../finance/purchases'
import { courseBundles } from '../catalog/course-bundles'
export const auditActionEnum = z.enum([
  'user_login',
  'user_logout',
  'purchase_completed',
  'lesson_access',
  'admin_action',
  'data_export',
  'permission_change',
  'content_moderation',
  'grade_modified',
  'enrollment_status_changed',
  'bundle_purchased',
])
export type AuditAction = z.infer<typeof auditActionEnum>
export const auditActionPgEnum = pgEnum('audit_action', [
  'user_login',
  'user_logout',
  'purchase_completed',
  'lesson_access',
  'admin_action',
  'data_export',
  'permission_change',
  'content_moderation',
  'grade_modified',
  'enrollment_status_changed',
  'bundle_purchased',
])
export const auditResourceTypeEnum = z.enum([
  'course',
  'module',
  'lesson',
  'enrollment',
  'quiz_attempt',
  'purchase',
  'user_account',
  'role_assignment',
  'bundle',
])
export type AuditResourceType = z.infer<typeof auditResourceTypeEnum>
export const auditResourceTypePgEnum = pgEnum('audit_resource_type', [
  'course',
  'module',
  'lesson',
  'enrollment',
  'quiz_attempt',
  'purchase',
  'user_account',
  'role_assignment',
  'bundle',
])
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    actorId: bigint('actor_id', { mode: 'number' }).references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    actorIp: inet('actor_ip'),
    action: auditActionPgEnum(),
    resourceType: auditResourceTypePgEnum(),
    courseId: bigint('course_id', { mode: 'number' }).references(() => courses.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    moduleId: bigint('module_id', { mode: 'number' }).references(() => modules.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    lessonId: bigint('lesson_id', { mode: 'number' }).references(() => lessons.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    enrollmentId: bigint('enrollment_id', { mode: 'number' }).references(() => enrollments.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    quizAttemptId: bigint('quiz_attempt_id', { mode: 'number' }).references(() => quizAttempts.id, {
      onDelete: 'set null',
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
    oldValues: jsonb('old_values'),
    newValues: jsonb('new_values'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_audit_logs_public').on(table.publicId),
    index('idx_audit_logs_actor_time').on(table.actorId, table.createdAt),
    index('idx_audit_logs_action_time').on(table.action, table.createdAt),
    index('idx_audit_logs_course').on(table.resourceType, table.courseId),
    index('idx_audit_logs_bundle').on(table.resourceType, table.bundleId),
    index('idx_audit_logs_time').on(table.createdAt),
  ],
)
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [auditLogs.courseId],
    references: [courses.id],
    relationName: 'course_audit_logs',
  }),
  module: one(modules, {
    fields: [auditLogs.moduleId],
    references: [modules.id],
    relationName: 'module_audit_logs',
  }),
  lesson: one(lessons, {
    fields: [auditLogs.lessonId],
    references: [lessons.id],
    relationName: 'lesson_audit_logs',
  }),
  enrollment: one(enrollments, {
    fields: [auditLogs.enrollmentId],
    references: [enrollments.id],
    relationName: 'enrollment_audit_logs',
  }),
  quizAttempt: one(quizAttempts, {
    fields: [auditLogs.quizAttemptId],
    references: [quizAttempts.id],
    relationName: 'quiz_audit_logs',
  }),
  purchase: one(purchases, {
    fields: [auditLogs.purchaseId],
    references: [purchases.id],
    relationName: 'purchase_audit_logs',
  }),
  bundle: one(courseBundles, {
    fields: [auditLogs.bundleId],
    references: [courseBundles.id],
    relationName: 'bundle_audit_logs',
  }),
}))
export const insertAuditLogSchema = createInsertSchema(auditLogs, {
  actorId: z.number().positive().nullable().optional(),
  actorIp: z.string().nullable().optional(),
  action: auditActionEnum,
  resourceType: auditResourceTypeEnum,
  courseId: z.number().positive().nullable().optional(),
  moduleId: z.number().positive().nullable().optional(),
  lessonId: z.number().positive().nullable().optional(),
  enrollmentId: z.number().positive().nullable().optional(),
  quizAttemptId: z.number().positive().nullable().optional(),
  purchaseId: z.number().positive().nullable().optional(),
  bundleId: z.number().positive().nullable().optional(),
  oldValues: z.record(z.string(), z.unknown()).nullable().optional(),
  newValues: z.record(z.string(), z.unknown()).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).omit({
  publicId: true,
})
export const selectAuditLogSchema = createSelectSchema(auditLogs)
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>
export type SelectAuditLog = z.infer<typeof selectAuditLogSchema>
