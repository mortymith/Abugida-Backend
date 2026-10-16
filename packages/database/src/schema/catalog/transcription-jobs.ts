import {
  pgTable,
  bigint,
  uuid,
  text,
  varchar,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { assetLibrary } from './asset-library'
import { transcripts } from './transcripts'
import { users } from '../auth/users'

/**
 * Async transcription jobs (spec 05 § S-3.6 — STT is async via BullMQ).
 *
 * The synchronous 180s timeout on the existing `generateTranscription`
 * server function cannot handle a 2-hour video. This table tracks each
 * transcription job — full-track or range regenerate — through its lifecycle
 * so the UI can show "Transcribing 3:20 / 12:34 — editing unlocks when it
 * finishes" and the worker can retry on failure.
 *
 * Lifecycle: `queued → processing → completed | failed`. A `failed` row
 * carries an error message and is per-range retryable.
 */
export const transcriptionJobStatusEnum = z.enum([
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled',
])
export type TranscriptionJobStatus = z.infer<typeof transcriptionJobStatusEnum>
export const transcriptionJobStatusPgEnum = pgEnum('transcription_job_status', [
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled',
])

export const transcriptionJobKindEnum = z.enum(['full', 'range'])
export type TranscriptionJobKind = z.infer<typeof transcriptionJobKindEnum>
export const transcriptionJobKindPgEnum = pgEnum('transcription_job_kind', ['full', 'range'])

export const transcriptionJobs = pgTable(
  'transcription_jobs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    assetId: bigint('asset_id', { mode: 'number' })
      .notNull()
      .references(() => assetLibrary.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    transcriptId: bigint('transcript_id', { mode: 'number' }).references(() => transcripts.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    /** BCP-47 language tag (e.g. `am`, `en`). Written to each segment + the .vtt `lang=` header. */
    language: varchar('language', { length: 10 }).notNull(),
    kind: transcriptionJobKindPgEnum().notNull().default('full'),
    /** For `kind='range'`: the time window to regenerate. NULL for full-track. */
    rangeStartMs: integer('range_start_ms'),
    rangeEndMs: integer('range_end_ms'),
    status: transcriptionJobStatusPgEnum().notNull().default('queued'),
    /** STT provider (e.g. `openai-whisper`). */
    provider: varchar('provider', { length: 100 }),
    /** Human-readable error message for `failed` jobs. */
    error: text('error'),
    /**
     * Summary of the result: `{ segmentCount, durationMs, detectedLanguage? }`.
     * Used by the UI to show "Transcribed 43 segments in 1m 23s."
     */
    resultSummary: jsonb('result_summary'),
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
    /** Set when the job reaches `completed` / `failed` / `cancelled`. */
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_transcription_jobs_public').on(table.publicId),
    index('idx_transcription_jobs_asset').on(table.assetId, table.status),
    index('idx_transcription_jobs_status').on(table.status, table.createdAt),
    index('idx_transcription_jobs_transcript').on(table.transcriptId),
    index('idx_transcription_jobs_creator').on(table.createdBy, table.status),
  ],
)

export const transcriptionJobsRelations = relations(transcriptionJobs, ({ one }) => ({
  asset: one(assetLibrary, {
    fields: [transcriptionJobs.assetId],
    references: [assetLibrary.id],
  }),
  transcript: one(transcripts, {
    fields: [transcriptionJobs.transcriptId],
    references: [transcripts.id],
  }),
  creator: one(users, {
    fields: [transcriptionJobs.createdBy],
    references: [users.id],
    relationName: 'transcription_job_creator',
  }),
}))

export const insertTranscriptionJobSchema = createInsertSchema(transcriptionJobs, {
  assetId: z.number().positive(),
  transcriptId: z.number().positive().nullable().optional(),
  language: z.string().trim().min(2).max(10),
  kind: transcriptionJobKindEnum.default('full'),
  rangeStartMs: z.number().int().min(0).nullable().optional(),
  rangeEndMs: z.number().int().min(0).nullable().optional(),
  status: transcriptionJobStatusEnum.default('queued'),
  provider: z.string().max(100).nullable().optional(),
  error: z.string().nullable().optional(),
  resultSummary: z.record(z.string(), z.unknown()).nullable().optional(),
}).omit({
  publicId: true,
})
export const selectTranscriptionJobSchema = createSelectSchema(transcriptionJobs)
export const updateTranscriptionJobSchema = insertTranscriptionJobSchema.partial()
export type InsertTranscriptionJob = z.infer<typeof insertTranscriptionJobSchema>
export type SelectTranscriptionJob = z.infer<typeof selectTranscriptionJobSchema>
export type UpdateTranscriptionJob = z.infer<typeof updateTranscriptionJobSchema>
