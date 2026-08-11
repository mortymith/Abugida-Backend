import {
  pgTable,
  bigint,
  uuid,
  varchar,
  numeric,
  char,
  jsonb,
  text,
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
import { purchases } from './purchases'
export const transactionTypeEnum = z.enum(['authorization', 'capture'])
export type TransactionType = z.infer<typeof transactionTypeEnum>
export const transactionTypePgEnum = pgEnum('transaction_type', ['authorization', 'capture'])
export const transactionStatusEnum = z.enum(['pending', 'succeeded', 'failed'])
export type TransactionStatus = z.infer<typeof transactionStatusEnum>
export const transactionStatusPgEnum = pgEnum('transaction_status', [
  'pending',
  'succeeded',
  'failed',
])
export const purchaseTransactions = pgTable(
  'purchase_transactions',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    purchaseId: bigint('purchase_id', { mode: 'number' })
      .notNull()
      .references(() => purchases.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    transactionType: transactionTypePgEnum(),
    externalTransactionId: varchar('external_transaction_id', { length: 255 }),
    amount: numeric('amount', { precision: 19, scale: 4 }).notNull(),
    currency: char('currency', { length: 3 }).notNull().default('ETB'),
    status: transactionStatusPgEnum().default('pending'),
    validationResponse: jsonb('validation_response'),
    errorMessage: text('error_message'),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_purchase_transactions_public').on(table.publicId),
    index('idx_purchase_transactions_purchase').on(table.purchaseId),
    index('idx_purchase_transactions_external').on(table.externalTransactionId),
    uniqueIndex('idx_purchase_transactions_idempotent').on(table.idempotencyKey),
    index('idx_purchase_transactions_pending').on(table.status, table.createdAt),

    check('amount_check', sql`${table.amount} >= 0`),
  ],
)
export const purchaseTransactionsRelations = relations(purchaseTransactions, ({ one }) => ({
  purchase: one(purchases, {
    fields: [purchaseTransactions.purchaseId],
    references: [purchases.id],
  }),
}))
export const insertPurchaseTransactionSchema = createInsertSchema(purchaseTransactions, {
  purchaseId: z.number().positive(),
  transactionType: transactionTypeEnum,
  externalTransactionId: z.string().max(255).nullable().optional(),
  amount: z.number().min(0),
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/)
    .default('ETB'),
  status: transactionStatusEnum.default('pending'),
  validationResponse: z.record(z.string(), z.unknown()).nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  idempotencyKey: z.string().min(1).max(255),
}).omit({
  publicId: true,
})
export const selectPurchaseTransactionSchema = createSelectSchema(purchaseTransactions)
export type InsertPurchaseTransaction = z.infer<typeof insertPurchaseTransactionSchema>
export type SelectPurchaseTransaction = z.infer<typeof selectPurchaseTransactionSchema>
