import { pgTable, bigint, uuid, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'
import { courses } from '../catalog/courses'
import { roles } from './roles'
export const courseRoles = pgTable(
  'course_roles',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    courseId: bigint('course_id', { mode: 'number' }).references(() => courses.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    roleId: bigint('role_id', { mode: 'number' })
      .notNull()
      .references(() => roles.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    grantedBy: bigint('granted_by', { mode: 'number' }).references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_course_roles_public').on(table.publicId),
    uniqueIndex('idx_course_roles_unique').on(table.userId, table.courseId, table.roleId),
    index('idx_course_roles_course_role').on(table.courseId, table.roleId),
    index('idx_course_roles_role').on(table.roleId),
    index('idx_course_roles_user').on(table.userId),
  ],
)
export const courseRolesRelations = relations(courseRoles, ({ one }) => ({
  user: one(users, {
    fields: [courseRoles.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [courseRoles.courseId],
    references: [courses.id],
  }),
  role: one(roles, {
    fields: [courseRoles.roleId],
    references: [roles.id],
  }),
  granter: one(users, {
    fields: [courseRoles.grantedBy],
    references: [users.id],
    relationName: 'role_granter',
  }),
}))
export const insertCourseRoleSchema = createInsertSchema(courseRoles, {
  userId: z.number().positive(),
  courseId: z.number().positive().nullable().optional(),
  roleId: z.number().positive(),
  grantedBy: z.number().positive().nullable().optional(),
  revokedAt: z.date().nullable().optional(),
}).omit({
  publicId: true,
})
export const selectCourseRoleSchema = createSelectSchema(courseRoles)
export const updateCourseRoleSchema = insertCourseRoleSchema.partial()
export type InsertCourseRole = z.infer<typeof insertCourseRoleSchema>
export type SelectCourseRole = z.infer<typeof selectCourseRoleSchema>
export type UpdateCourseRole = z.infer<typeof updateCourseRoleSchema>
