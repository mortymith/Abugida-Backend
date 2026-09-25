import {
  pgTable,
  bigint,
  uuid,
  numeric,
  integer,
  boolean,
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
import { courses } from './courses'

export const discountKindEnum = z.enum(['early_bird', 'bulk'])
export type DiscountKind = z.infer<typeof discountKindEnum>
export const discountKindPgEnum = pgEnum('discount_kind', ['early_bird', 'bulk'])

/**
 * Course-level discounts configured in the pricing wizard (spec 04 S-2.4):
 * early-bird percentage before a deadline, bulk percentage from a minimum
 * enrollment count. Checkout-wide coupon codes belong to S-8.3, not here.
 */
export const courseDiscounts = pgTable(
  'course_discounts',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    kind: discountKindPgEnum().notNull(),
    percentage: numeric('percentage', { precision: 5, scale: 2 }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    minEnrollments: integer('min_enrollments'),
    isActive: boolean('is_active').notNull().default(true),
    rowVersion: integer('row_version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_course_discounts_public').on(table.publicId),
    uniqueIndex('idx_course_discounts_unique').on(table.courseId, table.kind),
    index('idx_course_discounts_course').on(table.courseId),

    check('percentage_check', sql`${table.percentage} > 0 AND ${table.percentage} <= 99`),
    check(
      'min_enrollments_check',
      sql`${table.minEnrollments} > 0 OR ${table.minEnrollments} IS NULL`,
    ),
  ],
)
export const courseDiscountsRelations = relations(courseDiscounts, ({ one }) => ({
  course: one(courses, {
    fields: [courseDiscounts.courseId],
    references: [courses.id],
  }),
}))
export const insertCourseDiscountSchema = createInsertSchema(courseDiscounts, {
  courseId: z.number().positive(),
  kind: discountKindEnum,
  percentage: z.number().min(1).max(99),
  endsAt: z.date().nullable().optional(),
  minEnrollments: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
  rowVersion: z.number().int().min(1).default(1),
}).omit({
  publicId: true,
})
export const selectCourseDiscountSchema = createSelectSchema(courseDiscounts)
export const updateCourseDiscountSchema = insertCourseDiscountSchema.partial()
export type InsertCourseDiscount = z.infer<typeof insertCourseDiscountSchema>
export type SelectCourseDiscount = z.infer<typeof selectCourseDiscountSchema>
export type UpdateCourseDiscount = z.infer<typeof updateCourseDiscountSchema>
