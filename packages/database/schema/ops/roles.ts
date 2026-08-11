import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { courseRoles } from './course-roles'
export const roles = pgTable(
  'roles',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    name: varchar('name', { length: 50 }).notNull().unique(),
    description: text('description'),
    permissions: jsonb('permissions').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_roles_public').on(table.publicId),
    uniqueIndex('idx_roles_name').on(table.name),
  ],
)
export const rolesRelations = relations(roles, ({ many }) => ({
  courseRoles: many(courseRoles),
}))
export const insertRoleSchema = createInsertSchema(roles, {
  name: z.string().min(1).max(50),
  description: z.string().nullable().optional(),
  permissions: z.array(z.string()).default([]),
}).omit({
  publicId: true,
})
export const selectRoleSchema = createSelectSchema(roles)
export const updateRoleSchema = insertRoleSchema.partial()
export type InsertRole = z.infer<typeof insertRoleSchema>
export type SelectRole = z.infer<typeof selectRoleSchema>
export type UpdateRole = z.infer<typeof updateRoleSchema>
