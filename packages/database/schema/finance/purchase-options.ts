import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  numeric,
  char,
  timestamp,
  uniqueIndex,
  index,
  check,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { courses } from '../catalog/courses'
import { courseBundles } from '../catalog/course-bundles'
import { paymentGateways } from './payment-gateways'
export const platformEnum = z.enum(['ios', 'android', 'web'])
export type Platform = z.infer<typeof platformEnum>
export const purchasePlatformPgEnum = pgEnum('purchase_platform', ['ios', 'android', 'web'])
export const purchaseOptions = pgTable(
  'purchase_options',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    courseId: bigint('course_id', { mode: 'number' }).references(() => courses.id, {
      onDelete: 'restrict',
      onUpdate: 'cascade',
    }),
    bundleId: bigint('bundle_id', { mode: 'number' }).references(() => courseBundles.id, {
      onDelete: 'restrict',
      onUpdate: 'cascade',
    }),
    paymentGatewayId: bigint('payment_gateway_id', { mode: 'number' })
      .notNull()
      .references(() => paymentGateways.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    platform: purchasePlatformPgEnum(),
    productId: varchar('product_id', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 150 }).notNull(),
    description: text('description'),
    durationDays: integer('duration_days').notNull(),
    priceAmount: numeric('price_amount', { precision: 19, scale: 4 }).notNull(),
    priceCurrency: char('price_currency', { length: 3 }).notNull().default('ETB'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_purchase_options_public').on(table.publicId),
    index('idx_purchase_options_course').on(table.courseId, table.platform, table.isActive),
    index('idx_purchase_options_bundle').on(table.bundleId, table.platform, table.isActive),
    index('idx_purchase_options_gateway').on(table.paymentGatewayId),

    check('duration_check', sql`${table.durationDays} > 0`),
    check('price_check', sql`${table.priceAmount} >= 0`),
    check(
      'xor_constraint',
      sql`(${table.courseId} IS NOT NULL AND ${table.bundleId} IS NULL) OR 
        (${table.courseId} IS NULL AND ${table.bundleId} IS NOT NULL)`,
    ),
  ],
)
export const purchaseOptionsRelations = relations(purchaseOptions, ({ one }) => ({
  course: one(courses, {
    fields: [purchaseOptions.courseId],
    references: [courses.id],
    relationName: 'course_purchase_options',
  }),
  bundle: one(courseBundles, {
    fields: [purchaseOptions.bundleId],
    references: [courseBundles.id],
    relationName: 'bundle_purchase_options',
  }),
  gateway: one(paymentGateways, {
    fields: [purchaseOptions.paymentGatewayId],
    references: [paymentGateways.id],
  }),
}))
export const insertPurchaseOptionSchema = createInsertSchema(purchaseOptions, {
  courseId: z.number().positive().nullable().optional(),
  bundleId: z.number().positive().nullable().optional(),
  paymentGatewayId: z.number().positive(),
  platform: platformEnum,
  productId: z.string().min(1).max(255),
  displayName: z.string().min(1).max(150),
  description: z.string().nullable().optional(),
  durationDays: z.number().int().positive(),
  priceAmount: z.number().min(0),
  priceCurrency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/)
    .default('ETB'),
  isActive: z.boolean().default(true),
}).omit({
  publicId: true,
})
export const selectPurchaseOptionSchema = createSelectSchema(purchaseOptions)
export const updatePurchaseOptionSchema = insertPurchaseOptionSchema.partial()
export type InsertPurchaseOption = z.infer<typeof insertPurchaseOptionSchema>
export type SelectPurchaseOption = z.infer<typeof selectPurchaseOptionSchema>
export type UpdatePurchaseOption = z.infer<typeof updatePurchaseOptionSchema>
