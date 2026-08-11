import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  jsonb,
  smallint,
  timestamp,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

export const jobStatusEnum = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled'])
export type JobStatus = z.infer<typeof jobStatusEnum>
export const jobStatusPgEnum = pgEnum('job_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
])

export const jobPriorityEnum = z.enum(['low', 'normal', 'high', 'critical'])
export type JobPriority = z.infer<typeof jobPriorityEnum>
export const jobPriorityPgEnum = pgEnum('job_priority', ['low', 'normal', 'high', 'critical'])

export const jobQueue = pgTable(
  'job_queue',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    jobType: varchar('job_type', { length: 200 }).notNull(),
    payload: jsonb('payload').notNull().default({}),
    status: jobStatusPgEnum().notNull().default('pending'),
    priority: jobPriorityPgEnum().notNull().default('normal'),
    retryCount: smallint('retry_count').notNull().default(0),
    maxRetries: smallint('max_retries').notNull().default(3),
    lastError: text('last_error'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_job_queue_public').on(table.publicId),
    index('idx_job_queue_status_priority').on(table.status, table.priority, table.scheduledAt),
    index('idx_job_queue_type').on(table.jobType),
    index('idx_job_queue_scheduled').on(table.scheduledAt),
  ],
)

export const insertJobSchema = createInsertSchema(jobQueue, {
  jobType: z.string().min(1).max(200),
  payload: z.record(z.string(), z.unknown()).default({}),
  status: jobStatusEnum.default('pending'),
  priority: jobPriorityEnum.default('normal'),
  retryCount: z.number().int().min(0).default(0),
  maxRetries: z.number().int().min(0).max(10).default(3),
  lastError: z.string().nullable().optional(),
  scheduledAt: z.date().nullable().optional(),
  startedAt: z.date().nullable().optional(),
  completedAt: z.date().nullable().optional(),
}).omit({
  publicId: true,
})

export const selectJobSchema = createSelectSchema(jobQueue)
export const updateJobSchema = insertJobSchema.partial()

export type InsertJob = z.infer<typeof insertJobSchema>
export type SelectJob = z.infer<typeof selectJobSchema>
export type UpdateJob = z.infer<typeof updateJobSchema>
