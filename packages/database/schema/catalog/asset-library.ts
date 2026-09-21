import {
  pgTable,
  bigint,
  uuid,
  text,
  varchar,
  jsonb,
  integer,
  timestamp,
  uniqueIndex,
  index,
  pgEnum,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'

/**
 * Content Library (spec 05 S-3.1 – S-3.4). Central media repository for
 * videos, PDFs, images and audio used across courses.
 *
 * - `asset_folders` organize assets (one level of nesting supported via the
 *   self-referencing parent).
 * - `asset_library` holds metadata + the current object key; binaries live in
 *   S3-compatible storage (@abugida/storage) and are referenced by key.
 * - `asset_versions` keeps every uploaded file version (latest = current).
 * - Lesson→asset usage lives in `asset-usage.ts` (catalog domain) to keep the
 *   FK graph one-directional. Course-thumbnail usage is derived live from
 *   `courses.thumbnail_object_key` instead of being denormalized.
 */

export const assetCategoryEnum = z.enum(['video', 'image', 'audio', 'document', 'other'])
export type AssetCategory = z.infer<typeof assetCategoryEnum>
export const assetCategoryPgEnum = pgEnum('asset_category', [
  'video',
  'image',
  'audio',
  'document',
  'other',
])

export const assetFolders = pgTable(
  'asset_folders',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    name: varchar('name', { length: 120 }).notNull(),
    parentId: bigint('parent_id', { mode: 'number' }).references(
      (): AnyPgColumn => assetFolders.id,
      {
        onDelete: 'set null',
        onUpdate: 'cascade',
      },
    ),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_asset_folders_public').on(table.publicId),
    index('idx_asset_folders_parent').on(table.parentId),
    index('idx_asset_folders_active')
      .on(table.parentId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
)

export const assetLibrary = pgTable(
  'asset_library',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    name: varchar('name', { length: 300 }).notNull(),
    description: text('description'),
    tags: jsonb('tags').notNull().default([]),
    category: assetCategoryPgEnum().notNull().default('other'),
    folderId: bigint('folder_id', { mode: 'number' }).references(() => assetFolders.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    currentVersion: integer('current_version').notNull().default(1),
    objectKey: varchar('object_key', { length: 500 }).notNull(),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    mimeType: varchar('mime_type', { length: 100 }),
    durationSeconds: integer('duration_seconds'),
    uploadedBy: text('uploaded_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_asset_library_public').on(table.publicId),
    index('idx_asset_library_folder').on(table.folderId),
    index('idx_asset_library_category').on(table.category),
    index('idx_asset_library_uploaded_by').on(table.uploadedBy, table.createdAt),
    index('idx_asset_library_name').on(table.name),
    index('idx_asset_library_active_list')
      .on(table.folderId, table.createdAt)
      .where(sql`${table.deletedAt} IS NULL`),

    check('asset_size_check', sql`${table.fileSizeBytes} >= 0 OR ${table.fileSizeBytes} IS NULL`),
    check(
      'asset_duration_check',
      sql`${table.durationSeconds} >= 0 OR ${table.durationSeconds} IS NULL`,
    ),
    check('asset_version_check', sql`${table.currentVersion} >= 1`),
  ],
)

export const assetVersions = pgTable(
  'asset_versions',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    assetId: bigint('asset_id', { mode: 'number' })
      .notNull()
      .references(() => assetLibrary.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    versionNumber: integer('version_number').notNull(),
    objectKey: varchar('object_key', { length: 500 }).notNull(),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    mimeType: varchar('mime_type', { length: 100 }),
    durationSeconds: integer('duration_seconds'),
    note: varchar('note', { length: 300 }),
    uploadedBy: text('uploaded_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_asset_versions_public').on(table.publicId),
    uniqueIndex('idx_asset_versions_asset_number').on(table.assetId, table.versionNumber),
    index('idx_asset_versions_asset').on(table.assetId),
  ],
)

export const assetFoldersRelations = relations(assetFolders, ({ one, many }) => ({
  parent: one(assetFolders, {
    fields: [assetFolders.parentId],
    references: [assetFolders.id],
    relationName: 'asset_folder_parent',
  }),
  children: many(assetFolders, { relationName: 'asset_folder_parent' }),
  assets: many(assetLibrary),
}))

export const assetLibraryRelations = relations(assetLibrary, ({ one, many }) => ({
  folder: one(assetFolders, {
    fields: [assetLibrary.folderId],
    references: [assetFolders.id],
  }),
  uploader: one(users, {
    fields: [assetLibrary.uploadedBy],
    references: [users.id],
  }),
  versions: many(assetVersions),
}))

export const assetVersionsRelations = relations(assetVersions, ({ one }) => ({
  asset: one(assetLibrary, {
    fields: [assetVersions.assetId],
    references: [assetLibrary.id],
  }),
  uploader: one(users, {
    fields: [assetVersions.uploadedBy],
    references: [users.id],
  }),
}))

export const insertAssetFolderSchema = createInsertSchema(assetFolders, {
  name: z.string().trim().min(1).max(120),
}).omit({ publicId: true })
export const selectAssetFolderSchema = createSelectSchema(assetFolders)
export type InsertAssetFolder = z.infer<typeof insertAssetFolderSchema>
export type SelectAssetFolder = z.infer<typeof selectAssetFolderSchema>

export const insertAssetSchema = createInsertSchema(assetLibrary, {
  name: z.string().trim().min(1).max(300),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
}).omit({ publicId: true })
export const selectAssetSchema = createSelectSchema(assetLibrary)
export type InsertAsset = z.infer<typeof insertAssetSchema>
export type SelectAsset = z.infer<typeof selectAssetSchema>

export const insertAssetVersionSchema = createInsertSchema(assetVersions).omit({ publicId: true })
export const selectAssetVersionSchema = createSelectSchema(assetVersions)
export type InsertAssetVersion = z.infer<typeof insertAssetVersionSchema>
export type SelectAssetVersion = z.infer<typeof selectAssetVersionSchema>
