import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

export const permissionsReference = pgTable(
  'permissions_reference',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    resource: varchar('resource', { length: 100 }).notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    displayName: varchar('display_name', { length: 150 }).notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_permissions_reference_public').on(table.publicId),
    uniqueIndex('idx_permissions_reference_resource_action').on(table.resource, table.action),
    index('idx_permissions_reference_resource').on(table.resource),
    index('idx_permissions_reference_active').on(table.isActive),
  ],
)

export const insertPermissionsReferenceSchema = createInsertSchema(permissionsReference, {
  resource: z.string().min(1).max(100),
  action: z.string().min(1).max(50),
  displayName: z.string().min(1).max(150),
  description: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
}).omit({
  publicId: true,
})

export const selectPermissionsReferenceSchema = createSelectSchema(permissionsReference)
export const updatePermissionsReferenceSchema = insertPermissionsReferenceSchema.partial()

export type InsertPermissionsReference = z.infer<typeof insertPermissionsReferenceSchema>
export type SelectPermissionsReference = z.infer<typeof selectPermissionsReferenceSchema>
export type UpdatePermissionsReference = z.infer<typeof updatePermissionsReferenceSchema>
