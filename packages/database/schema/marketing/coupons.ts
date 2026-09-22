import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  char,
  numeric,
  boolean,
  integer,
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
import { users } from '../auth/users'
import { courses } from '../catalog/courses'
import { purchases } from '../finance/purchases'

/**
 * Checkout-wide discount & coupon codes (spec 10 S-8.3). Distinct from the
 * pricing-wizard `course_discounts` (early-bird / bulk). Codes are stored
 * uppercase and matched case-insensitively at checkout; single-use batches
 * share a `batchId` so a generated run can be exported as one CSV.
 */

export const couponKindEnum = z.enum(['percentage', 'fixed', 'full_access'])
export type CouponKind = z.infer<typeof couponKindEnum>
export const couponKindPgEnum = pgEnum('coupon_kind', ['percentage', 'fixed', 'full_access'])

export const coupons = pgTable(
  'coupons',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    /** Stored uppercase; checkout compares case-insensitively. */
    code: varchar('code', { length: 40 }).notNull(),
    kind: couponKindPgEnum().notNull(),
    /** Percentage (1-99) or absolute amount for `fixed`; null for full access. */
    value: numeric('value', { precision: 19, scale: 4 }),
    currency: char('currency', { length: 3 }).notNull().default('ETB'),
    /** Null max redemptions = unlimited; single-use codes set 1. */
    maxRedemptions: integer('max_redemptions'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    stackable: boolean('stackable').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    /** Groups codes generated as one single-use batch (CSV export run). */
    batchId: uuid('batch_id'),
    batchLabel: varchar('batch_label', { length: 200 }),
    createdBy: text('created_by').references(() => users.id, {
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
    uniqueIndex('idx_coupons_public').on(table.publicId),
    uniqueIndex('idx_coupons_code').on(table.code),
    index('idx_coupons_batch').on(table.batchId),
    index('idx_coupons_active').on(table.isActive, table.expiresAt),
    check(
      'coupon_percentage_check',
      sql`${table.kind} <> 'percentage' OR (${table.value} >= 1 AND ${table.value} <= 99)`,
    ),
    check('coupon_fixed_check', sql`${table.kind} <> 'fixed' OR ${table.value} > 0`),
    check(
      'coupon_full_access_check',
      sql`${table.kind} <> 'full_access' OR ${table.value} IS NULL`,
    ),
  ],
)

/** Scope: empty table = any course; rows restrict redemption to the courses. */
export const couponCourses = pgTable(
  'coupon_courses',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    couponId: bigint('coupon_id', { mode: 'number' })
      .notNull()
      .references(() => coupons.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  },
  (table) => [
    uniqueIndex('idx_coupon_courses_unique').on(table.couponId, table.courseId),
    index('idx_coupon_courses_course').on(table.courseId),
  ],
)

export const couponRedemptions = pgTable(
  'coupon_redemptions',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    couponId: bigint('coupon_id', { mode: 'number' })
      .notNull()
      .references(() => coupons.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    /** Completed purchase the redemption is attributed to. */
    purchaseId: bigint('purchase_id', { mode: 'number' }).references(() => purchases.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    amountDiscounted: numeric('amount_discounted', { precision: 19, scale: 4 }).notNull(),
    currency: char('currency', { length: 3 }).notNull().default('ETB'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_coupon_redemptions_public').on(table.publicId),
    index('idx_coupon_redemptions_coupon').on(table.couponId, table.createdAt),
    index('idx_coupon_redemptions_user').on(table.userId),
    index('idx_coupon_redemptions_purchase').on(table.purchaseId),
  ],
)

export const couponsRelations = relations(coupons, ({ one, many }) => ({
  creator: one(users, {
    fields: [coupons.createdBy],
    references: [users.id],
  }),
  scope: many(couponCourses),
  redemptions: many(couponRedemptions),
}))

export const couponCoursesRelations = relations(couponCourses, ({ one }) => ({
  coupon: one(coupons, {
    fields: [couponCourses.couponId],
    references: [coupons.id],
  }),
  course: one(courses, {
    fields: [couponCourses.courseId],
    references: [courses.id],
  }),
}))

export const couponRedemptionsRelations = relations(couponRedemptions, ({ one }) => ({
  coupon: one(coupons, {
    fields: [couponRedemptions.couponId],
    references: [coupons.id],
  }),
  user: one(users, {
    fields: [couponRedemptions.userId],
    references: [users.id],
  }),
  purchase: one(purchases, {
    fields: [couponRedemptions.purchaseId],
    references: [purchases.id],
  }),
}))

export const insertCouponSchema = createInsertSchema(coupons, {
  code: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, 'Code can only contain letters, numbers, hyphens and underscores'),
  kind: couponKindEnum,
  value: z.number().min(0).nullable().optional(),
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/)
    .default('ETB'),
  maxRedemptions: z.number().int().min(1).nullable().optional(),
  stackable: z.boolean().default(false),
  isActive: z.boolean().default(true),
}).omit({ publicId: true })
export const selectCouponSchema = createSelectSchema(coupons)
export type InsertCoupon = z.infer<typeof insertCouponSchema>
export type SelectCoupon = z.infer<typeof selectCouponSchema>
