import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { purchaseOptions } from './purchase-options'
import { purchases } from './purchases'
export const paymentProviderEnum = z.enum(['telebirr'])
export type PaymentProvider = z.infer<typeof paymentProviderEnum>
export const paymentProviderPgEnum = pgEnum('payment_provider', ['telebirr'])
export const paymentGateways = pgTable(
  'payment_gateways',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    providerName: paymentProviderPgEnum(),
    displayName: varchar('display_name', { length: 100 }).notNull(),
    isEnabled: boolean('is_enabled').notNull().default(true),
    requiresDisclosure: boolean('requires_disclosure').notNull().default(false),
    disclosureText: text('disclosure_text'),
    apiConfig: jsonb('api_config').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_payment_gateways_public').on(table.publicId),
    uniqueIndex('idx_payment_gateways_provider').on(table.providerName),
    index('idx_payment_gateways_enabled').on(table.isEnabled),
  ],
)
export const paymentGatewaysRelations = relations(paymentGateways, ({ many }) => ({
  purchaseOptions: many(purchaseOptions),
  purchases: many(purchases),
}))
export const insertPaymentGatewaySchema = createInsertSchema(paymentGateways, {
  providerName: paymentProviderEnum,
  displayName: z.string().min(1).max(100),
  isEnabled: z.boolean().default(true),
  requiresDisclosure: z.boolean().default(false),
  disclosureText: z.string().nullable().optional(),
  apiConfig: z.record(z.string(), z.unknown()).default({}),
}).omit({
  publicId: true,
})
export const selectPaymentGatewaySchema = createSelectSchema(paymentGateways)
export const updatePaymentGatewaySchema = insertPaymentGatewaySchema.partial()
export type InsertPaymentGateway = z.infer<typeof insertPaymentGatewaySchema>
export type SelectPaymentGateway = z.infer<typeof selectPaymentGatewaySchema>
export type UpdatePaymentGateway = z.infer<typeof updatePaymentGatewaySchema>
