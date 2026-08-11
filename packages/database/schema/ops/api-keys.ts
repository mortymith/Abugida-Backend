import {
  pgTable,
  bigint,
  uuid,
  varchar,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'

export const apiKeys = pgTable(
  'api_keys',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    name: varchar('name', { length: 100 }).notNull(),
    keyHash: varchar('key_hash', { length: 255 }).notNull().unique(),
    keyPrefix: varchar('key_prefix', { length: 20 }).notNull(),
    scopes: jsonb('scopes').notNull().default([]),
    rateLimit: bigint('rate_limit', { mode: 'number' }).notNull().default(1000),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_api_keys_public').on(table.publicId),
    uniqueIndex('idx_api_keys_key_hash').on(table.keyHash),
    index('idx_api_keys_user').on(table.userId),
    index('idx_api_keys_active').on(table.isActive),
    index('idx_api_keys_expires').on(table.expiresAt),
  ],
)

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}))

export const insertApiKeySchema = createInsertSchema(apiKeys, {
  userId: z.number().positive(),
  name: z.string().min(1).max(100),
  keyHash: z.string().min(1).max(255),
  keyPrefix: z.string().min(1).max(20),
  scopes: z.array(z.string()).default([]),
  rateLimit: z.number().int().min(1).default(1000),
  expiresAt: z.date().nullable().optional(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).omit({
  publicId: true,
})

export const selectApiKeySchema = createSelectSchema(apiKeys)
export const updateApiKeySchema = insertApiKeySchema.partial()

export type InsertApiKey = z.infer<typeof insertApiKeySchema>
export type SelectApiKey = z.infer<typeof selectApiKeySchema>
export type UpdateApiKey = z.infer<typeof updateApiKeySchema>
