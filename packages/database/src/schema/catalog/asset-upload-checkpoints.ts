import {
  pgTable,
  bigint,
  uuid,
  text,
  varchar,
  timestamp,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { organization } from '../auth/organization'
import { users } from '../auth/users'

/**
 * Resumable upload checkpoints (spec 05 § S-3.2 — uploads are resumable).
 *
 * A row is created when a chunked upload starts and deleted when it
 * completes (or purged 7 days after the last chunk — decision D4). The
 * `multipartUploadId` is the S3 multipart upload ID; `uploadedBytes` is the
 * sum of confirmed part sizes, checkpointed every 8 MB or 10 s (decision
 * D2). On resume, the client calls `listUploadedParts` and the server
 * reconciles `uploadedBytes` from the actual S3 part list — the row is a
 * hint, S3 is the source of truth.
 *
 * A `paused` row is one the user paused (or that lost connection); an
 * `active` row is mid-upload. `aborted` rows are kept for 24 h for audit,
 * then purged. `expired` rows are past the 7-day retention and awaiting
 * purge by the background worker.
 */
export const uploadCheckpointStatusEnum = z.enum([
  'active',
  'paused',
  'completed',
  'aborted',
  'expired',
])
export type UploadCheckpointStatus = z.infer<typeof uploadCheckpointStatusEnum>
export const uploadCheckpointStatusPgEnum = pgEnum('upload_checkpoint_status', [
  'active',
  'paused',
  'completed',
  'aborted',
  'expired',
])

export const assetUploadCheckpoints = pgTable(
  'asset_upload_checkpoints',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    /**
     * Client-generated draft ID (UUID). The client uses this to key its
     * IndexedDB queue before the server-side row exists, then the server
     * row links them.
     */
    assetDraftId: uuid('asset_draft_id').notNull(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    /** S3 object key the bytes are being uploaded to. */
    objectKey: varchar('object_key', { length: 500 }).notNull(),
    /** S3 multipart upload ID — null until `initiateMultipartUpload` returns. */
    multipartUploadId: varchar('multipart_upload_id', { length: 500 }),
    totalBytes: bigint('total_bytes', { mode: 'number' }).notNull(),
    uploadedBytes: bigint('uploaded_bytes', { mode: 'number' }).notNull().default(0),
    /** When the last chunk was confirmed — used by the 7-day purge worker. */
    lastChunkAt: timestamp('last_chunk_at', { withTimezone: true }).notNull().defaultNow(),
    status: uploadCheckpointStatusPgEnum().notNull().default('active'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_asset_upload_checkpoints_public').on(table.publicId),
    uniqueIndex('idx_asset_upload_checkpoints_draft').on(table.assetDraftId),
    index('idx_asset_upload_checkpoints_org_status').on(table.organizationId, table.status),
    index('idx_asset_upload_checkpoints_creator').on(table.createdBy, table.status),
    /** Partial index for the purge worker: expired-or-stale-paused rows. */
    index('idx_asset_upload_checkpoints_purge')
      .on(table.lastChunkAt)
      .where(sql`${table.status} IN ('active', 'paused')`),
  ],
)

export const assetUploadCheckpointsRelations = relations(assetUploadCheckpoints, ({ one }) => ({
  organization: one(organization, {
    fields: [assetUploadCheckpoints.organizationId],
    references: [organization.id],
  }),
  creator: one(users, {
    fields: [assetUploadCheckpoints.createdBy],
    references: [users.id],
    relationName: 'upload_checkpoint_creator',
  }),
}))

export const insertAssetUploadCheckpointSchema = createInsertSchema(assetUploadCheckpoints, {
  assetDraftId: z.string().uuid(),
  objectKey: z.string().min(1).max(500),
  multipartUploadId: z.string().max(500).nullable().optional(),
  totalBytes: z.number().int().min(0),
  uploadedBytes: z.number().int().min(0).default(0),
  status: uploadCheckpointStatusEnum.default('active'),
}).omit({
  publicId: true,
})
export const selectAssetUploadCheckpointSchema = createSelectSchema(assetUploadCheckpoints)
export const updateAssetUploadCheckpointSchema = insertAssetUploadCheckpointSchema.partial()
export type InsertAssetUploadCheckpoint = z.infer<typeof insertAssetUploadCheckpointSchema>
export type SelectAssetUploadCheckpoint = z.infer<typeof selectAssetUploadCheckpointSchema>
export type UpdateAssetUploadCheckpoint = z.infer<typeof updateAssetUploadCheckpointSchema>
