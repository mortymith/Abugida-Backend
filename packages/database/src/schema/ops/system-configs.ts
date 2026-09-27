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
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

export const systemConfigs = pgTable(
  'system_configs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    key: varchar('key', { length: 200 }).notNull().unique(),
    value: jsonb('value').notNull(),
    description: text('description'),
    isEncrypted: boolean('is_encrypted').notNull().default(false),
    category: varchar('category', { length: 100 }).notNull().default('general'),
    updatedBy: bigint('updated_by', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_system_configs_public').on(table.publicId),
    uniqueIndex('idx_system_configs_key').on(table.key),
    index('idx_system_configs_category').on(table.category),
  ],
)

export const insertSystemConfigSchema = createInsertSchema(systemConfigs, {
  key: z.string().min(1).max(200),
  value: z.record(z.string(), z.unknown()),
  description: z.string().nullable().optional(),
  isEncrypted: z.boolean().default(false),
  category: z.string().min(1).max(100).default('general'),
  updatedBy: z.number().positive().nullable().optional(),
}).omit({
  publicId: true,
})

export const selectSystemConfigSchema = createSelectSchema(systemConfigs)
export const updateSystemConfigSchema = insertSystemConfigSchema.partial()

export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>
export type SelectSystemConfig = z.infer<typeof selectSystemConfigSchema>
export type UpdateSystemConfig = z.infer<typeof updateSystemConfigSchema>
