import { pgTable, bigint, uuid, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'
import { lessons } from './lessons'
import { assetLibrary } from './asset-library'

/**
 * Lesson → asset usage registry (spec 05 S-3.3 "Used In"). Rows are written
 * transactionally by the lesson save flow when a lesson's media comes from
 * the Content Library. Course-thumbnail usage is derived live from
 * `courses.thumbnail_object_key` and intentionally not denormalized here.
 *
 * Lives in the catalog domain (next to lessons) so the FK graph stays
 * strictly one-directional: lessons → asset-library, asset-usage → both.
 */
export const assetUsage = pgTable(
  'asset_usage',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    assetId: bigint('asset_id', { mode: 'number' })
      .notNull()
      .references(() => assetLibrary.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    lessonId: bigint('lesson_id', { mode: 'number' })
      .notNull()
      .references(() => lessons.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_asset_usage_public').on(table.publicId),
    uniqueIndex('idx_asset_usage_asset_lesson').on(table.assetId, table.lessonId),
    index('idx_asset_usage_lesson').on(table.lessonId),
  ],
)

export const assetUsageRelations = relations(assetUsage, ({ one }) => ({
  asset: one(assetLibrary, {
    fields: [assetUsage.assetId],
    references: [assetLibrary.id],
  }),
  lesson: one(lessons, {
    fields: [assetUsage.lessonId],
    references: [lessons.id],
  }),
}))

export const insertAssetUsageSchema = createInsertSchema(assetUsage).omit({ publicId: true })
export const selectAssetUsageSchema = createSelectSchema(assetUsage)
export type InsertAssetUsage = z.infer<typeof insertAssetUsageSchema>
export type SelectAssetUsage = z.infer<typeof selectAssetUsageSchema>
