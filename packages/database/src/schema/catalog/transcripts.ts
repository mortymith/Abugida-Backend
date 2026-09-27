import {
  pgTable,
  bigint,
  uuid,
  text,
  varchar,
  jsonb,
  boolean,
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
import { assetLibrary } from './asset-library'

/**
 * Transcription & subtitles (spec 05 S-3.6). One transcript per
 * (video/audio asset, language); segments carry monotonic, non-overlapping
 * timing. The published track feeds lesson captions and the searchable
 * transcript (S-1.3 Global Search).
 */

export const transcriptStatusEnum = z.enum(['draft', 'published', 'failed'])
export type TranscriptStatus = z.infer<typeof transcriptStatusEnum>
export const transcriptStatusPgEnum = pgEnum('transcript_status', ['draft', 'published', 'failed'])

export const transcriptSourceEnum = z.enum(['manual', 'imported', 'stt', 'translated'])
export type TranscriptSource = z.infer<typeof transcriptSourceEnum>
export const transcriptSourcePgEnum = pgEnum('transcript_source', [
  'manual',
  'imported',
  'stt',
  'translated',
])

export const captionStyleSchema = z.object({
  font: z.enum(['inter', 'system', 'serif', 'mono']).default('inter'),
  fontSizePx: z.union([z.literal(14), z.literal(16), z.literal(18), z.literal(20)]).default(16),
  background: z.enum(['none', 'semi', 'opaque']).default('semi'),
})
export type CaptionStyle = z.infer<typeof captionStyleSchema>

export interface TranscriptCaptionStyle {
  font: 'inter' | 'system' | 'serif' | 'mono'
  fontSizePx: 14 | 16 | 18 | 20
  background: 'none' | 'semi' | 'opaque'
}

export const transcripts = pgTable(
  'transcripts',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    assetId: bigint('asset_id', { mode: 'number' })
      .notNull()
      .references(() => assetLibrary.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    language: varchar('language', { length: 10 }).notNull().default('en'),
    status: transcriptStatusPgEnum().notNull().default('draft'),
    showByDefault: boolean('show_by_default').notNull().default(true),
    captionStyle: jsonb('caption_style').$type<TranscriptCaptionStyle>(),
    source: transcriptSourcePgEnum().notNull().default('manual'),
    translatedFromId: bigint('translated_from_id', { mode: 'number' }).references(
      (): AnyPgColumn => transcripts.id,
      {
        onDelete: 'set null',
        onUpdate: 'cascade',
      },
    ),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_transcripts_public').on(table.publicId),
    uniqueIndex('idx_transcripts_asset_language').on(table.assetId, table.language),
    index('idx_transcripts_asset_status').on(table.assetId, table.status),
  ],
)

export const transcriptSegments = pgTable(
  'transcript_segments',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    transcriptId: bigint('transcript_id', { mode: 'number' })
      .notNull()
      .references(() => transcripts.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    segmentIndex: integer('segment_index').notNull(),
    startMs: integer('start_ms').notNull(),
    endMs: integer('end_ms').notNull(),
    speaker: varchar('speaker', { length: 80 }),
    text: text('text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_transcript_segments_public').on(table.publicId),
    uniqueIndex('idx_transcript_segments_order').on(table.transcriptId, table.segmentIndex),
    index('idx_transcript_segments_transcript').on(table.transcriptId),

    check('segment_time_check', sql`${table.endMs} > ${table.startMs}`),
    check('segment_start_check', sql`${table.startMs} >= 0`),
  ],
)

export const transcriptsRelations = relations(transcripts, ({ one, many }) => ({
  asset: one(assetLibrary, {
    fields: [transcripts.assetId],
    references: [assetLibrary.id],
  }),
  segments: many(transcriptSegments),
}))

export const transcriptSegmentsRelations = relations(transcriptSegments, ({ one }) => ({
  transcript: one(transcripts, {
    fields: [transcriptSegments.transcriptId],
    references: [transcripts.id],
  }),
}))

export const insertTranscriptSchema = createInsertSchema(transcripts, {
  language: z.string().trim().min(2).max(10),
}).omit({ publicId: true })
export const selectTranscriptSchema = createSelectSchema(transcripts)
export type InsertTranscript = z.infer<typeof insertTranscriptSchema>
export type SelectTranscript = z.infer<typeof selectTranscriptSchema>

export const insertTranscriptSegmentSchema = createInsertSchema(transcriptSegments, {
  text: z.string().trim().min(1).max(2_000),
}).omit({ publicId: true })
export const selectTranscriptSegmentSchema = createSelectSchema(transcriptSegments)
export type InsertTranscriptSegment = z.infer<typeof insertTranscriptSegmentSchema>
export type SelectTranscriptSegment = z.infer<typeof selectTranscriptSegmentSchema>
