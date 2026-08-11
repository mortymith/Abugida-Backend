import {
  pgTable,
  bigint,
  uuid,
  timestamp,
  varchar,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { contentLicenses } from './content-licenses'
import { users } from '../auth/users'
import { purchases } from './purchases'
export const licenseGrantStatusEnum = z.enum(['active', 'expired', 'revoked'])
export type LicenseGrantStatus = z.infer<typeof licenseGrantStatusEnum>
export const licenseGrantStatusPgEnum = pgEnum('license_grant_status', [
  'active',
  'expired',
  'revoked',
])
export const contentLicenseGrants = pgTable(
  'content_license_grants',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    contentLicenseId: bigint('content_license_id', { mode: 'number' })
      .notNull()
      .references(() => contentLicenses.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    studentId: bigint('student_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    purchaseId: bigint('purchase_id', { mode: 'number' }).references(() => purchases.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    accessExpiresAt: timestamp('access_expires_at', {
      withTimezone: true,
    }).notNull(),
    status: licenseGrantStatusPgEnum().default('active'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokeReason: varchar('revoke_reason', { length: 200 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_content_license_grants_public').on(table.publicId),
    index('idx_clg_student_status').on(table.studentId, table.status),
    index('idx_clg_license_status').on(table.contentLicenseId, table.status),
    index('idx_clg_expiry').on(table.accessExpiresAt),
    index('idx_clg_purchase').on(table.purchaseId),
    index('idx_clg_active_expiring')
      .on(table.status, table.accessExpiresAt)
      .where(sql`status = 'active'`),
  ],
)
export const contentLicenseGrantsRelations = relations(contentLicenseGrants, ({ one }) => ({
  license: one(contentLicenses, {
    fields: [contentLicenseGrants.contentLicenseId],
    references: [contentLicenses.id],
  }),
  student: one(users, {
    fields: [contentLicenseGrants.studentId],
    references: [users.id],
  }),
  purchase: one(purchases, {
    fields: [contentLicenseGrants.purchaseId],
    references: [purchases.id],
  }),
}))
export const insertContentLicenseGrantSchema = createInsertSchema(contentLicenseGrants, {
  contentLicenseId: z.number().positive(),
  studentId: z.number().positive(),
  purchaseId: z.number().positive().nullable().optional(),
  accessExpiresAt: z.date(),
  status: licenseGrantStatusEnum.default('active'),
  revokedAt: z.date().nullable().optional(),
  revokeReason: z.string().max(200).nullable().optional(),
}).omit({
  publicId: true,
})
export const selectContentLicenseGrantSchema = createSelectSchema(contentLicenseGrants)
export const updateContentLicenseGrantSchema = insertContentLicenseGrantSchema.partial()
export type InsertContentLicenseGrant = z.infer<typeof insertContentLicenseGrantSchema>
export type SelectContentLicenseGrant = z.infer<typeof selectContentLicenseGrantSchema>
export type UpdateContentLicenseGrant = z.infer<typeof updateContentLicenseGrantSchema>
