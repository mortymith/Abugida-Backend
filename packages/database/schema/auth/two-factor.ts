import { pgTable, text, boolean, integer, timestamp, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from './users'

/**
 * Better Auth two-factor plugin storage (model `twoFactor`).
 *
 * Required by `twoFactor()` in `createAuth()` — one row per user holding the
 * encrypted TOTP secret and hashed backup codes.
 */
export const twoFactor = pgTable(
  'twoFactor',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    verified: boolean('verified').notNull().default(true),
    failedVerificationCount: integer('failed_verification_count').notNull().default(0),
    lockedUntil: timestamp('locked_until'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_two_factor_user_id').on(table.userId),
    index('idx_two_factor_secret').on(table.secret),
  ],
)

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
  user: one(users, {
    fields: [twoFactor.userId],
    references: [users.id],
  }),
}))

export const insertTwoFactorSchema = createInsertSchema(twoFactor)
export const selectTwoFactorSchema = createSelectSchema(twoFactor)
export const updateTwoFactorSchema = createUpdateSchema(twoFactor).partial()
export type InsertTwoFactor = z.infer<typeof insertTwoFactorSchema>
export type SelectTwoFactor = z.infer<typeof selectTwoFactorSchema>
export type UpdateTwoFactor = z.infer<typeof updateTwoFactorSchema>
