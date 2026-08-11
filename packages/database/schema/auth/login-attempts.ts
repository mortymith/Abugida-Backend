import {
  pgTable,
  bigint,
  uuid,
  varchar,
  char,
  boolean,
  timestamp,
  inet,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
export const loginAttemptTypeEnum = z.enum(['oauth_login', 'token_refresh'])
export type LoginAttemptType = z.infer<typeof loginAttemptTypeEnum>
export const loginAttemptTypePgEnum = pgEnum('login_attempt_type', ['oauth_login', 'token_refresh'])
export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    phoneNumberLast4: char('phone_number_last4', { length: 4 }).notNull(),
    ipAddress: inet('ip_address').notNull(),
    userAgent: varchar('user_agent', { length: 500 }),
    attemptType: loginAttemptTypePgEnum(),
    isSuccessful: boolean('is_successful').notNull(),
    failureReason: varchar('failure_reason', { length: 100 }),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
    retentionExpiresAt: timestamp('retention_expires_at', {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_login_attempts_public').on(table.publicId),
    index('idx_login_attempts_phone_time').on(table.phoneNumberLast4, table.attemptedAt),
    index('idx_login_attempts_ip_time').on(table.ipAddress, table.attemptedAt),
    index('idx_login_attempts_time').on(table.attemptedAt),
    index('idx_login_attempts_retention').on(table.retentionExpiresAt),
  ],
)
export const insertLoginAttemptSchema = createInsertSchema(loginAttempts, {
  phoneNumberLast4: z.string().length(4),
  ipAddress: z.string(),
  userAgent: z.string().max(500).nullable().optional(),
  attemptType: loginAttemptTypeEnum,
  isSuccessful: z.boolean(),
  failureReason: z.string().max(100).nullable().optional(),
  retentionExpiresAt: z.date(),
}).omit({
  publicId: true,
})
export const selectLoginAttemptSchema = createSelectSchema(loginAttempts)
export type InsertLoginAttempt = z.infer<typeof insertLoginAttemptSchema>
export type SelectLoginAttempt = z.infer<typeof selectLoginAttemptSchema>
