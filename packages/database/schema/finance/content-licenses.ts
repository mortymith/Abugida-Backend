import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  numeric,
  char,
  uniqueIndex,
  index,
  check,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { lessons } from '../catalog/lessons'
import { users } from '../auth/users'
import { contentLicenseGrants } from './content-license-grants'
export const contentLicenseTypeEnum = z.enum([
  'perpetual',
  'subscription',
  'limited_use',
  'open_source',
])
export type ContentLicenseType = z.infer<typeof contentLicenseTypeEnum>
export const contentLicenseTypePgEnum = pgEnum('content_license_type', [
  'perpetual',
  'subscription',
  'limited_use',
  'open_source',
])
export const contentLicenseStatusEnum = z.enum(['active', 'expiring_soon', 'expired', 'revoked'])
export type ContentLicenseStatus = z.infer<typeof contentLicenseStatusEnum>
export const contentLicenseStatusPgEnum = pgEnum('content_license_status', [
  'active',
  'expiring_soon',
  'expired',
  'revoked',
])
export const contentLicenses = pgTable(
  'content_licenses',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    lessonId: bigint('lesson_id', { mode: 'number' })
      .notNull()
      .references(() => lessons.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    licenseType: contentLicenseTypePgEnum(),
    licenseTerms: text('license_terms'),
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }),
    autoRenewal: boolean('auto_renewal').notNull().default(false),
    renewalReminderDays: integer('renewal_reminder_days').notNull().default(30),
    status: contentLicenseStatusPgEnum().default('active'),
    gracePeriodDays: integer('grace_period_days').notNull().default(90),
    licensorName: varchar('licensor_name', { length: 200 }),
    licensorContact: varchar('licensor_contact', { length: 300 }),
    costAmount: numeric('cost_amount', { precision: 19, scale: 4 }),
    costCurrency: char('cost_currency', { length: 3 }).notNull().default('ETB'),
    createdBy: bigint('created_by', { mode: 'number' }).references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_content_licenses_public').on(table.publicId),
    index('idx_content_licenses_lesson_status').on(table.lessonId, table.status),
    index('idx_content_licenses_expiry_monitor').on(table.endDate, table.status),

    check(
      'end_date_check',
      sql`${table.endDate} >= ${table.startDate} OR ${table.endDate} IS NULL`,
    ),
    check(
      'reminder_days_check',
      sql`${table.renewalReminderDays} >= 0 AND ${table.renewalReminderDays} <= 365`,
    ),
    check(
      'grace_period_check',
      sql`${table.gracePeriodDays} >= 0 AND ${table.gracePeriodDays} <= 365`,
    ),
    check('cost_check', sql`${table.costAmount} >= 0 OR ${table.costAmount} IS NULL`),
  ],
)
export const contentLicensesRelations = relations(contentLicenses, ({ one, many }) => ({
  lesson: one(lessons, {
    fields: [contentLicenses.lessonId],
    references: [lessons.id],
  }),
  creator: one(users, {
    fields: [contentLicenses.createdBy],
    references: [users.id],
  }),
  grants: many(contentLicenseGrants),
}))
export const insertContentLicenseSchema = createInsertSchema(contentLicenses, {
  lessonId: z.number().positive(),
  licenseType: contentLicenseTypeEnum,
  licenseTerms: z.string().nullable().optional(),
  startDate: z.date(),
  endDate: z.date().nullable().optional(),
  autoRenewal: z.boolean().default(false),
  renewalReminderDays: z.number().int().min(0).max(365).default(30),
  status: contentLicenseStatusEnum.default('active'),
  gracePeriodDays: z.number().int().min(0).max(365).default(90),
  licensorName: z.string().max(200).nullable().optional(),
  licensorContact: z.string().max(300).nullable().optional(),
  costAmount: z.number().min(0).nullable().optional(),
  costCurrency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/)
    .default('ETB'),
  createdBy: z.number().positive().nullable().optional(),
}).omit({
  publicId: true,
})
export const selectContentLicenseSchema = createSelectSchema(contentLicenses)
export const updateContentLicenseSchema = insertContentLicenseSchema.partial()
export type InsertContentLicense = z.infer<typeof insertContentLicenseSchema>
export type SelectContentLicense = z.infer<typeof selectContentLicenseSchema>
export type UpdateContentLicense = z.infer<typeof updateContentLicenseSchema>
