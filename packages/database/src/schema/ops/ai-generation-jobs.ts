import {
  pgTable,
  bigint,
  uuid,
  text,
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
import { users } from '../auth/users'

export const aiJobKindEnum = z.enum(['course_outline', 'quiz_draft'])
export type AiJobKind = z.infer<typeof aiJobKindEnum>
export const aiJobKindPgEnum = pgEnum('ai_job_kind', ['course_outline', 'quiz_draft'])
export const aiJobStatusEnum = z.enum(['completed', 'failed', 'cancelled'])
export type AiJobStatus = z.infer<typeof aiJobStatusEnum>
export const aiJobStatusPgEnum = pgEnum('ai_job_status', ['completed', 'failed', 'cancelled'])

/**
 * AI generation jobs (spec 04 S-2.11 / S-2.16). The generated draft is
 * persisted as JSON for provenance/audit; accepted drafts are written into
 * the standard course/quiz tables. Nothing is ever applied silently.
 */
export const aiGenerationJobs = pgTable(
  'ai_generation_jobs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    kind: aiJobKindPgEnum().notNull(),
    status: aiJobStatusPgEnum().notNull().default('completed'),
    prompt: text('prompt').notNull(),
    params: jsonb('params').notNull().default({}),
    result: jsonb('result'),
    error: text('error'),
    provider: text('provider').notNull().default('local'),
    tokensUsed: integer('tokens_used'),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_ai_generation_jobs_public').on(table.publicId),
    index('idx_ai_generation_jobs_kind_status').on(table.kind, table.status),
    index('idx_ai_generation_jobs_created_by').on(table.createdBy),
  ],
)
export const aiGenerationJobsRelations = relations(aiGenerationJobs, ({ one }) => ({
  creator: one(users, {
    fields: [aiGenerationJobs.createdBy],
    references: [users.id],
  }),
}))
export const insertAiGenerationJobSchema = createInsertSchema(aiGenerationJobs, {
  kind: aiJobKindEnum,
  status: aiJobStatusEnum.default('completed'),
  prompt: z.string().min(1),
  params: z.record(z.string(), z.unknown()).default({}),
  provider: z.string().default('local'),
  tokensUsed: z.number().int().min(0).nullable().optional(),
  createdBy: z.string().nullable().optional(),
}).omit({
  publicId: true,
})
export const selectAiGenerationJobSchema = createSelectSchema(aiGenerationJobs)
export type InsertAiGenerationJob = z.infer<typeof insertAiGenerationJobSchema>
export type SelectAiGenerationJob = z.infer<typeof selectAiGenerationJobSchema>
