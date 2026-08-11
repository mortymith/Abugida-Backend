import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  jsonb,
  boolean,
  timestamp,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'

export const principalTypeEnum = z.enum(['user', 'service_account', 'system'])
export type PrincipalType = z.infer<typeof principalTypeEnum>
export const principalTypePgEnum = pgEnum('principal_type', ['user', 'service_account', 'system'])

export const principals = pgTable(
  'principals',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    userId: bigint('user_id', { mode: 'number' }).references(() => users.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    principalType: principalTypePgEnum().notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    metadata: jsonb('metadata').notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_principals_public').on(table.publicId),
    index('idx_principals_user').on(table.userId),
    index('idx_principals_type').on(table.principalType),
    index('idx_principals_active').on(table.isActive),
  ],
)

export const principalsRelations = relations(principals, ({ one }) => ({
  user: one(users, {
    fields: [principals.userId],
    references: [users.id],
  }),
}))

export const insertPrincipalSchema = createInsertSchema(principals, {
  userId: z.number().positive().nullable().optional(),
  principalType: principalTypeEnum,
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  isActive: z.boolean().default(true),
}).omit({
  publicId: true,
})

export const selectPrincipalSchema = createSelectSchema(principals)
export const updatePrincipalSchema = insertPrincipalSchema.partial()

export type InsertPrincipal = z.infer<typeof insertPrincipalSchema>
export type SelectPrincipal = z.infer<typeof selectPrincipalSchema>
export type UpdatePrincipal = z.infer<typeof updatePrincipalSchema>
