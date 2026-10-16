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
import { users } from '../auth/users'
import { organization } from '../auth/organization'

/**
 * Async export jobs (spec 07 § S-5.4 — exports are asynchronous over 1 MB).
 *
 * An export under 1 MB downloads directly. At or over 1 MB it becomes a
 * queued job: a row is created here, the BullMQ queue generates the report,
 * writes it to storage, and updates the status. The download link is valid
 * for 7 days, then the state becomes `expired` and the file is purged.
 *
 * Revenue is redacted server-side: a role without `finance.view_revenue`
 * can never produce a report containing revenue — the option is absent,
 * not disabled, and a hand-crafted request returns no revenue columns.
 */
export const exportJobStatusEnum = z.enum(['generating', 'queued', 'ready', 'expired', 'failed'])
export type ExportJobStatus = z.infer<typeof exportJobStatusEnum>
export const exportJobStatusPgEnum = pgEnum('export_job_status', [
  'generating',
  'queued',
  'ready',
  'expired',
  'failed',
])

export const exportReportTypeEnum = z.enum([
  'course_performance',
  'student_progress',
  'quiz_analytics',
  'revenue_report',
  'cohort_comparison',
  'funnel',
])
export type ExportReportType = z.infer<typeof exportReportTypeEnum>
export const exportReportTypePgEnum = pgEnum('export_report_type', [
  'course_performance',
  'student_progress',
  'quiz_analytics',
  'revenue_report',
  'cohort_comparison',
  'funnel',
])

export const exportFormatEnum = z.enum(['csv', 'xlsx', 'pdf'])
export type ExportFormat = z.infer<typeof exportFormatEnum>
export const exportFormatPgEnum = pgEnum('export_format', ['csv', 'xlsx', 'pdf'])

export const exportJobs = pgTable(
  'export_jobs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    reportType: exportReportTypePgEnum().notNull(),
    format: exportFormatPgEnum().notNull(),
    /** JSON array of course public IDs. */
    courseIds: text('course_ids').array().notNull().default([]),
    rangeStart: timestamp('range_start', { withTimezone: true }).notNull(),
    rangeEnd: timestamp('range_end', { withTimezone: true }).notNull(),
    includeAggregatedCharts: text('include_aggregated_charts').notNull().default('false'),
    includeStudentLevelData: text('include_student_level_data').notNull().default('false'),
    /** Optional lesson ID for quiz-analytics exports. */
    lessonId: text('lesson_id'),
    /** Optional cohort IDs for cohort-comparison exports. */
    cohortIds: text('cohort_ids').array().default([]),
    status: exportJobStatusPgEnum().notNull().default('queued'),
    /** Estimated row count shown before generating ("≈ 1,204 students × 24 items"). */
    rowEstimate: bigint('row_estimate', { mode: 'number' }),
    /** Actual file size in bytes once generated. */
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    /** Storage object key for the generated file. */
    storageKey: varchar('storage_key', { length: 500 }),
    /** 7-day expiry (spec S-5.4). */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    /** Error message for `failed` state. */
    errorMessage: text('error_message'),
    /** Request ID for debugging. */
    requestId: varchar('request_id', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_export_jobs_public').on(table.publicId),
    index('idx_export_jobs_user_status').on(table.userId, table.status),
    index('idx_export_jobs_org_status').on(table.organizationId, table.status),
    /** Partial index for ready exports not yet expired (download list). */
    index('idx_export_jobs_ready')
      .on(table.expiresAt)
      .where(sql`${table.status} = 'ready'`),
    /** Partial index for the expiry sweep worker. */
    index('idx_export_jobs_expiry_sweep')
      .on(table.expiresAt)
      .where(sql`${table.status} = 'ready' AND ${table.expiresAt} IS NOT NULL`),
  ],
)

export const exportJobsRelations = relations(exportJobs, ({ one }) => ({
  user: one(users, {
    fields: [exportJobs.userId],
    references: [users.id],
    relationName: 'export_job_user',
  }),
  organization: one(organization, {
    fields: [exportJobs.organizationId],
    references: [organization.id],
  }),
}))

export const insertExportJobSchema = createInsertSchema(exportJobs, {
  reportType: exportReportTypeEnum,
  format: exportFormatEnum,
  status: exportJobStatusEnum.default('queued'),
  courseIds: z.array(z.string()).default([]),
  cohortIds: z.array(z.string()).default([]),
}).omit({
  publicId: true,
})
export const selectExportJobSchema = createSelectSchema(exportJobs)
export const updateExportJobSchema = insertExportJobSchema.partial()
export type InsertExportJob = z.infer<typeof insertExportJobSchema>
export type SelectExportJob = z.infer<typeof selectExportJobSchema>
export type UpdateExportJob = z.infer<typeof updateExportJobSchema>
