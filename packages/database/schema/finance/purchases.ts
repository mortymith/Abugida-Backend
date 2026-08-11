import {
  pgTable,
  bigint,
  uuid,
  varchar,
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
import { users } from '../auth/users'
import { courses } from '../catalog/courses'
import { courseBundles } from '../catalog/course-bundles'
import { purchaseOptions } from './purchase-options'
import { paymentGateways } from './payment-gateways'
import { purchaseTransactions } from './purchase-transactions'
import { enrollments } from '../learning/enrollments'
import { auditLogs } from '../ops/audit-logs'
export const purchaseStatusEnum = z.enum(['initiated', 'payment_pending', 'completed', 'failed'])
export type PurchaseStatus = z.infer<typeof purchaseStatusEnum>
export const purchaseStatusPgEnum = pgEnum('purchase_status', [
  'initiated',
  'payment_pending',
  'completed',
  'failed',
])
export const purchases = pgTable(
  'purchases',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    studentId: bigint('student_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    courseId: bigint('course_id', { mode: 'number' }).references(() => courses.id, {
      onDelete: 'restrict',
      onUpdate: 'cascade',
    }),
    bundleId: bigint('bundle_id', { mode: 'number' }).references(() => courseBundles.id, {
      onDelete: 'restrict',
      onUpdate: 'cascade',
    }),
    purchaseOptionId: bigint('purchase_option_id', { mode: 'number' })
      .notNull()
      .references(() => purchaseOptions.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    paymentGatewayId: bigint('payment_gateway_id', { mode: 'number' })
      .notNull()
      .references(() => paymentGateways.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    status: purchaseStatusPgEnum().default('initiated'),
    amount: numeric('amount', { precision: 19, scale: 4 }).notNull(),
    currency: char('currency', { length: 3 }).notNull().default('ETB'),
    receiptObjectKey: varchar('receipt_object_key', { length: 500 }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_purchases_public').on(table.publicId),
    index('idx_purchases_student_time').on(table.studentId, table.createdAt),
    index('idx_purchases_course').on(table.courseId),
    index('idx_purchases_bundle').on(table.bundleId),
    index('idx_purchases_option').on(table.purchaseOptionId),
    index('idx_purchases_status').on(table.status),
    index('idx_purchases_student_course').on(table.studentId, table.courseId),
    index('idx_purchases_student_bundle').on(table.studentId, table.bundleId),
    index('idx_purchases_status_time').on(table.status, table.createdAt),

    check('amount_check', sql`${table.amount} >= 0`),
    check(
      'xor_constraint',
      sql`(${table.courseId} IS NOT NULL AND ${table.bundleId} IS NULL) OR 
        (${table.courseId} IS NULL AND ${table.bundleId} IS NOT NULL)`,
    ),
  ],
)
export const purchasesRelations = relations(purchases, ({ one, many }) => ({
  student: one(users, {
    fields: [purchases.studentId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [purchases.courseId],
    references: [courses.id],
    relationName: 'course_purchases',
  }),
  bundle: one(courseBundles, {
    fields: [purchases.bundleId],
    references: [courseBundles.id],
    relationName: 'bundle_purchases',
  }),
  option: one(purchaseOptions, {
    fields: [purchases.purchaseOptionId],
    references: [purchaseOptions.id],
  }),
  gateway: one(paymentGateways, {
    fields: [purchases.paymentGatewayId],
    references: [paymentGateways.id],
  }),
  transactions: many(purchaseTransactions),
  enrollments: many(enrollments),
  auditLogs: many(auditLogs, {
    relationName: 'purchase_audit_logs',
  }),
}))
export const insertPurchaseSchema = createInsertSchema(purchases, {
  studentId: z.number().positive(),
  courseId: z.number().positive().nullable().optional(),
  bundleId: z.number().positive().nullable().optional(),
  purchaseOptionId: z.number().positive(),
  paymentGatewayId: z.number().positive(),
  status: purchaseStatusEnum.default('initiated'),
  amount: z.number().min(0),
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/)
    .default('ETB'),
  receiptObjectKey: z.string().max(500).nullable().optional(),
  completedAt: z.date().nullable().optional(),
}).omit({
  publicId: true,
})
export const selectPurchaseSchema = createSelectSchema(purchases)
export const updatePurchaseSchema = insertPurchaseSchema.partial()
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>
export type SelectPurchase = z.infer<typeof selectPurchaseSchema>
export type UpdatePurchase = z.infer<typeof updatePurchaseSchema>
