import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod'
import { z } from 'zod'

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('idx_verification_identifier').on(table.identifier)],
)

export const insertVerificationSchema = createInsertSchema(verification)
export const selectVerificationSchema = createSelectSchema(verification)
export const updateVerificationSchema = createUpdateSchema(verification).partial()
export type InsertVerification = z.infer<typeof insertVerificationSchema>
export type SelectVerification = z.infer<typeof selectVerificationSchema>
export type UpdateVerification = z.infer<typeof updateVerificationSchema>
