import {
  pgTable,
  bigint,
  uuid,
  varchar,
  boolean,
  timestamp,
  inet,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from './users'
export const consentTypeEnum = z.enum([
  'essential',
  'analytics',
  'personalization',
  'marketing',
  'third_party_sharing',
])
export type ConsentType = z.infer<typeof consentTypeEnum>
export const consentTypePgEnum = pgEnum('consent_type', [
  'essential',
  'analytics',
  'personalization',
  'marketing',
  'third_party_sharing',
])
export const userConsents = pgTable(
  'user_consents',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    consentType: consentTypePgEnum(),
    consentVersion: varchar('consent_version', { length: 20 }).notNull(),
    isGranted: boolean('is_granted').notNull(),
    ipAddress: inet('ip_address'),
    consentedAt: timestamp('consented_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_consents_public').on(table.publicId),
    index('idx_consents_user').on(table.userId),
    uniqueIndex('idx_consents_unique').on(table.userId, table.consentType, table.consentVersion),
  ],
)
export const userConsentsRelations = relations(userConsents, ({ one }) => ({
  user: one(users, {
    fields: [userConsents.userId],
    references: [users.id],
  }),
}))
export const insertUserConsentSchema = createInsertSchema(userConsents, {
  consentType: consentTypeEnum,
  consentVersion: z.string().min(1).max(20),
  isGranted: z.boolean(),
  ipAddress: z.string().nullable().optional(),
}).omit({
  publicId: true,
})
export const selectUserConsentSchema = createSelectSchema(userConsents)
export type InsertUserConsent = z.infer<typeof insertUserConsentSchema>
export type SelectUserConsent = z.infer<typeof selectUserConsentSchema>
