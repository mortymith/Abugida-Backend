import {
  pgTable,
  bigint,
  uuid,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { courses } from '../catalog/courses'
import { paymentGateways } from './payment-gateways'

/**
 * Per-course payment-gateway enablement (spec 04 S-2.20 → _Pricing &
 * enrollment_ section, decision D1).
 *
 * `payment_gateways` is the workspace-level registry; this join table lets an
 * Admin/Editor enable a subset of those gateways for a specific course and
 * attach per-course config (e.g. merchant ID override, settlement account).
 *
 * RC-6 (Pricing consistent) requires "at least one payment gateway enabled"
 * for paid courses — that check reads this table.
 */
export const paymentGatewaySettings = pgTable(
  'payment_gateway_settings',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    gatewayId: bigint('gateway_id', { mode: 'number' })
      .notNull()
      .references(() => paymentGateways.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    isEnabled: boolean('is_enabled').notNull().default(true),
    /**
     * Per-course override of the gateway's workspace config. Empty by
     * default — falls back to the gateway's `api_config`.
     */
    config: jsonb('config').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_payment_gateway_settings_public').on(table.publicId),
    // A gateway can be configured for a course at most once.
    uniqueIndex('idx_payment_gateway_settings_course_gateway').on(table.courseId, table.gatewayId),
    index('idx_payment_gateway_settings_course').on(table.courseId),
    index('idx_payment_gateway_settings_gateway').on(table.gatewayId),
    index('idx_payment_gateway_settings_enabled').on(table.courseId, table.isEnabled),
  ],
)

export const paymentGatewaySettingsRelations = relations(paymentGatewaySettings, ({ one }) => ({
  course: one(courses, {
    fields: [paymentGatewaySettings.courseId],
    references: [courses.id],
  }),
  gateway: one(paymentGateways, {
    fields: [paymentGatewaySettings.gatewayId],
    references: [paymentGateways.id],
  }),
}))

export const insertPaymentGatewaySettingSchema = createInsertSchema(paymentGatewaySettings, {
  courseId: z.number().positive(),
  gatewayId: z.number().positive(),
  isEnabled: z.boolean().default(true),
  config: z.record(z.string(), z.unknown()).default({}),
}).omit({
  publicId: true,
})
export const selectPaymentGatewaySettingSchema = createSelectSchema(paymentGatewaySettings)
export const updatePaymentGatewaySettingSchema = insertPaymentGatewaySettingSchema.partial()
export type InsertPaymentGatewaySetting = z.infer<typeof insertPaymentGatewaySettingSchema>
export type SelectPaymentGatewaySetting = z.infer<typeof selectPaymentGatewaySettingSchema>
export type UpdatePaymentGatewaySetting = z.infer<typeof updatePaymentGatewaySettingSchema>
