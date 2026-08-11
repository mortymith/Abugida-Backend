import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

export const featureFlags = pgTable(
  'feature_flags',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    key: varchar('key', { length: 100 }).notNull().unique(),
    displayName: varchar('display_name', { length: 150 }).notNull(),
    description: text('description'),
    isEnabled: boolean('is_enabled').notNull().default(false),
    rolloutPercentage: bigint('rollout_percentage', { mode: 'number' }).notNull().default(0),
    allowedUserIds: jsonb('allowed_user_ids').notNull().default([]),
    deniedUserIds: jsonb('denied_user_ids').notNull().default([]),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_feature_flags_public').on(table.publicId),
    uniqueIndex('idx_feature_flags_key').on(table.key),
    index('idx_feature_flags_enabled').on(table.isEnabled),
  ],
)

export const insertFeatureFlagSchema = createInsertSchema(featureFlags, {
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_]+$/),
  displayName: z.string().min(1).max(150),
  description: z.string().nullable().optional(),
  isEnabled: z.boolean().default(false),
  rolloutPercentage: z.number().int().min(0).max(100).default(0),
  allowedUserIds: z.array(z.number()).default([]),
  deniedUserIds: z.array(z.number()).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).omit({
  publicId: true,
})

export const selectFeatureFlagSchema = createSelectSchema(featureFlags)
export const updateFeatureFlagSchema = insertFeatureFlagSchema.partial()

export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>
export type SelectFeatureFlag = z.infer<typeof selectFeatureFlagSchema>
export type UpdateFeatureFlag = z.infer<typeof updateFeatureFlagSchema>
