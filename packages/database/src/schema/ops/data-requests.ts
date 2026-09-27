import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'

/**
 * Data-subject request queue (spec 08 S-6.10 Privacy & Data Retention).
 * Admins record export/erase requests received from students; the SLA
 * deadline is the requested date plus the statutory 30 days (computed in the
 * settings feature's pure sla module). Erasure completion references the
 * users deletion lifecycle columns so analytics remain reproducible.
 */
export const dataRequests = pgTable(
  'data_requests',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    requestType: varchar('request_type', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('open'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedBy: text('completed_by'),
    notes: text('notes'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_data_requests_public').on(table.publicId),
    index('idx_data_requests_student').on(table.studentId),
    index('idx_data_requests_status').on(table.status, table.requestedAt),
  ],
)

export const dataRequestsRelations = relations(dataRequests, ({ one }) => ({
  student: one(users, {
    fields: [dataRequests.studentId],
    references: [users.id],
  }),
}))

export const insertDataRequestSchema = createInsertSchema(dataRequests, {
  studentId: z.string().min(1),
  requestType: z.enum(['export', 'delete']),
  status: z.enum(['open', 'completed']).default('open'),
  notes: z.string().max(2000).nullable().optional(),
}).omit({
  publicId: true,
})

export const selectDataRequestSchema = createSelectSchema(dataRequests)
export type InsertDataRequest = z.infer<typeof insertDataRequestSchema>
export type SelectDataRequest = z.infer<typeof selectDataRequestSchema>
