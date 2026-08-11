import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  numeric,
  timestamp,
  integer,
  smallint,
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
import { examTypes } from './exam-types'
import { users } from '../auth/users'
import { bundleCourses } from './bundle-courses'
import { purchaseOptions } from '../finance/purchase-options'
import { purchases } from '../finance/purchases'
import { enrollments } from '../learning/enrollments'
import { auditLogs } from '../ops/audit-logs'
export const bundleStatusEnum = z.enum(['draft', 'published', 'archived'])
export type BundleStatus = z.infer<typeof bundleStatusEnum>
export const bundleStatusPgEnum = pgEnum('bundle_status', ['draft', 'published', 'archived'])
export const courseBundles = pgTable(
  'course_bundles',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    examTypeId: bigint('exam_type_id', { mode: 'number' })
      .notNull()
      .references(() => examTypes.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    instructorId: bigint('instructor_id', { mode: 'number' }).references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    title: varchar('title', { length: 300 }).notNull(),
    slug: varchar('slug', { length: 200 }).notNull().unique(),
    description: text('description'),
    thumbnailObjectKey: varchar('thumbnail_object_key', { length: 500 }),
    priceAmount: numeric('price_amount', { precision: 19, scale: 4 }).notNull(),
    priceCurrency: char('price_currency', { length: 3 }).notNull().default('ETB'),
    originalPriceAmount: numeric('original_price_amount', {
      precision: 19,
      scale: 4,
    }).notNull(),
    discountPercentage: numeric('discount_percentage', {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default('0'),
    status: bundleStatusPgEnum().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    rowVersion: integer('row_version').notNull().default(1),
    sortOrder: smallint('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_course_bundles_public').on(table.publicId),
    index('idx_bundles_exam_status').on(table.examTypeId, table.status, table.sortOrder),
    uniqueIndex('idx_bundles_slug').on(table.slug),
    index('idx_bundles_instructor').on(table.instructorId),
    index('idx_bundles_status').on(table.status),
    index('idx_bundles_active')
      .on(table.examTypeId, table.status)
      .where(sql`${table.deletedAt} IS NULL`),

    check('price_check', sql`${table.priceAmount} >= 0`),
    check('original_price_check', sql`${table.originalPriceAmount} >= 0`),
    check(
      'discount_check',
      sql`${table.discountPercentage} >= 0 AND ${table.discountPercentage} <= 100`,
    ),
    check('sort_order_check', sql`${table.sortOrder} >= 0`),
  ],
)
export const courseBundlesRelations = relations(courseBundles, ({ one, many }) => ({
  examType: one(examTypes, {
    fields: [courseBundles.examTypeId],
    references: [examTypes.id],
  }),
  instructor: one(users, {
    fields: [courseBundles.instructorId],
    references: [users.id],
  }),
  bundleCourses: many(bundleCourses),
  purchaseOptions: many(purchaseOptions, {
    relationName: 'bundle_purchase_options',
  }),
  purchases: many(purchases, {
    relationName: 'bundle_purchases',
  }),
  enrollments: many(enrollments, {
    relationName: 'bundle_enrollments',
  }),
  auditLogs: many(auditLogs, {
    relationName: 'bundle_audit_logs',
  }),
}))
export const insertBundleSchema = createInsertSchema(courseBundles, {
  title: z.string().min(1).max(300),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().nullable().optional(),
  examTypeId: z.number().positive(),
  instructorId: z.number().positive().nullable().optional(),
  thumbnailObjectKey: z.string().max(500).nullable().optional(),
  priceAmount: z.number().min(0),
  priceCurrency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/)
    .default('ETB'),
  originalPriceAmount: z.number().min(0),
  discountPercentage: z.number().min(0).max(100).default(0),
  status: bundleStatusEnum.default('draft'),
  publishedAt: z.date().nullable().optional(),
  rowVersion: z.number().int().min(1).default(1),
  sortOrder: z.number().int().min(0).default(0),
}).omit({
  publicId: true,
})
export const selectBundleSchema = createSelectSchema(courseBundles)
export const updateBundleSchema = insertBundleSchema.partial()
export type InsertBundle = z.infer<typeof insertBundleSchema>
export type SelectBundle = z.infer<typeof selectBundleSchema>
export type UpdateBundle = z.infer<typeof updateBundleSchema>
