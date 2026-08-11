import {
  pgTable,
  bigint,
  uuid,
  varchar,
  boolean,
  timestamp,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'
import { lessons } from '../catalog/lessons'
export const fileMetadata = pgTable(
  'file_metadata',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    objectKey: varchar('object_key', { length: 500 }).notNull().unique(),
    bucketName: varchar('bucket_name', { length: 100 }).notNull(),
    originalFilename: varchar('original_filename', { length: 500 }),
    mimeType: varchar('mime_type', { length: 100 }),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    checksumSha256: varchar('checksum_sha256', { length: 64 }),
    encryptionKeyReference: varchar('encryption_key_reference', {
      length: 500,
    }),
    isPublic: boolean('is_public').notNull().default(false),
    lessonId: bigint('lesson_id', { mode: 'number' }).references(() => lessons.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    uploadedBy: bigint('uploaded_by', { mode: 'number' }).references(() => users.id, {
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
    uniqueIndex('idx_file_metadata_public').on(table.publicId),
    uniqueIndex('idx_file_metadata_object_key').on(table.objectKey),
    index('idx_file_metadata_bucket').on(table.bucketName),
    index('idx_file_metadata_uploader_time').on(table.uploadedBy, table.createdAt),
    index('idx_file_metadata_lesson').on(table.lessonId),

    check('file_size_check', sql`${table.fileSizeBytes} >= 0 OR ${table.fileSizeBytes} IS NULL`),
  ],
)
export const fileMetadataRelations = relations(fileMetadata, ({ one }) => ({
  uploader: one(users, {
    fields: [fileMetadata.uploadedBy],
    references: [users.id],
  }),
  lesson: one(lessons, {
    fields: [fileMetadata.lessonId],
    references: [lessons.id],
  }),
}))
export const insertFileMetadataSchema = createInsertSchema(fileMetadata, {
  objectKey: z.string().min(1).max(500),
  bucketName: z.string().min(1).max(100),
  originalFilename: z.string().max(500).nullable().optional(),
  mimeType: z.string().max(100).nullable().optional(),
  fileSizeBytes: z.number().int().min(0).nullable().optional(),
  checksumSha256: z.string().length(64).nullable().optional(),
  encryptionKeyReference: z.string().max(500).nullable().optional(),
  isPublic: z.boolean().default(false),
  lessonId: z.number().positive().nullable().optional(),
  uploadedBy: z.number().positive().nullable().optional(),
}).omit({
  publicId: true,
})
export const selectFileMetadataSchema = createSelectSchema(fileMetadata)
export const updateFileMetadataSchema = insertFileMetadataSchema.partial()
export type InsertFileMetadata = z.infer<typeof insertFileMetadataSchema>
export type SelectFileMetadata = z.infer<typeof selectFileMetadataSchema>
export type UpdateFileMetadata = z.infer<typeof updateFileMetadataSchema>
