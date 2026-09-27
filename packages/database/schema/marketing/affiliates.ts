import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  char,
  numeric,
  jsonb,
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
import { users } from '../auth/users'
import { courses } from '../catalog/courses'
import { purchases } from '../finance/purchases'

/**
 * Affiliate program (spec 10 S-4.8→S-8.4): applications, per-course referral
 * links/codes, click/purchase attribution events, commissions snapshotted at
 * sale time (rate changes are prospective only), and payout runs. Program
 * configuration (commission %, cookie window, payout threshold/method) lives
 * in `system_configs` under `marketing.affiliate_program` alongside the
 * other settings-adjacent values.
 */

export const affiliateStatusEnum = z.enum(['pending', 'approved', 'suspended', 'declined'])
export type AffiliateStatus = z.infer<typeof affiliateStatusEnum>
export const affiliateStatusPgEnum = pgEnum('affiliate_status', [
  'pending',
  'approved',
  'suspended',
  'declined',
])

export type AffiliatePayoutDetails = {
  method: string
  accountName?: string
  accountIdentifier?: string
}

export const affiliates = pgTable(
  'affiliates',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    /** Linked platform account when the affiliate signs up (self-referral checks). */
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    name: varchar('name', { length: 200 }).notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    status: affiliateStatusPgEnum().notNull().default('pending'),
    audience: text('audience'),
    channels: text('channels'),
    decisionNote: text('decision_note'),
    decidedBy: text('decided_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    /** Fraud review: links stay inert and pending commissions freeze. */
    commissionsHeld: boolean('commissions_held').notNull().default(false),
    fraudFlaggedAt: timestamp('fraud_flagged_at', { withTimezone: true }),
    fraudEvidence: jsonb('fraud_evidence').$type<{ reason: string; detail?: string }>(),
    payoutDetails: jsonb('payout_details').$type<AffiliatePayoutDetails>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_affiliates_public').on(table.publicId),
    index('idx_affiliates_status').on(table.status),
    index('idx_affiliates_user').on(table.userId),
    check('affiliates_email_check', sql`${table.email} <> ''`),
  ],
)

export const affiliateLinks = pgTable(
  'affiliate_links',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    affiliateId: bigint('affiliate_id', { mode: 'number' })
      .notNull()
      .references(() => affiliates.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    /** Null course = program-wide code. */
    courseId: bigint('course_id', { mode: 'number' }).references(() => courses.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    /** Unique referral code, e.g. `sara-toefl` or `DANIEL20`. */
    code: varchar('code', { length: 60 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_affiliate_links_public').on(table.publicId),
    uniqueIndex('idx_affiliate_links_code').on(table.code),
    index('idx_affiliate_links_affiliate').on(table.affiliateId),
  ],
)

export const affiliateEventTypeEnum = z.enum(['click', 'signup', 'purchase'])
export type AffiliateEventType = z.infer<typeof affiliateEventTypeEnum>
export const affiliateEventTypePgEnum = pgEnum('affiliate_event_type', [
  'click',
  'signup',
  'purchase',
])

/**
 * Attribution events written by the public checkout/signup flow. `userId`
 * on purchases enables self-referral fraud detection; the cookie window is
 * enforced by the attribution writer, not here.
 */
export const affiliateEvents = pgTable(
  'affiliate_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    affiliateId: bigint('affiliate_id', { mode: 'number' })
      .notNull()
      .references(() => affiliates.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    linkId: bigint('link_id', { mode: 'number' }).references(() => affiliateLinks.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    eventType: affiliateEventTypePgEnum().notNull(),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    purchaseId: bigint('purchase_id', { mode: 'number' }).references(() => purchases.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_affiliate_events_affiliate_type').on(table.affiliateId, table.eventType),
    index('idx_affiliate_events_purchase').on(table.purchaseId),
    index('idx_affiliate_events_user').on(table.userId),
  ],
)

export const commissionStatusEnum = z.enum(['pending', 'held', 'paid', 'reversed'])
export type CommissionStatus = z.infer<typeof commissionStatusEnum>
export const commissionStatusPgEnum = pgEnum('commission_status', [
  'pending',
  'held',
  'paid',
  'reversed',
])

export const commissions = pgTable(
  'commissions',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    affiliateId: bigint('affiliate_id', { mode: 'number' })
      .notNull()
      .references(() => affiliates.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    purchaseId: bigint('purchase_id', { mode: 'number' }).references(() => purchases.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    linkId: bigint('link_id', { mode: 'number' }).references(() => affiliateLinks.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    /** Snapshot of the program rate at sale time — never recomputed. */
    rate: numeric('rate', { precision: 5, scale: 2 }).notNull(),
    amount: numeric('amount', { precision: 19, scale: 4 }).notNull(),
    currency: char('currency', { length: 3 }).notNull().default('ETB'),
    status: commissionStatusPgEnum().notNull().default('pending'),
    payoutId: bigint('payout_id', { mode: 'number' }),
    reversedReason: text('reversed_reason'),
    reversedAt: timestamp('reversed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_commissions_public').on(table.publicId),
    index('idx_commissions_affiliate_status').on(table.affiliateId, table.status),
    index('idx_commissions_purchase').on(table.purchaseId),
    index('idx_commissions_payout').on(table.payoutId),
    check('commission_rate_check', sql`${table.rate} >= 0 AND ${table.rate} <= 100`),
    check('commission_amount_check', sql`${table.amount} >= 0`),
  ],
)

export const payoutStatusEnum = z.enum(['pending', 'paid', 'failed'])
export type PayoutStatus = z.infer<typeof payoutStatusEnum>
export const payoutStatusPgEnum = pgEnum('affiliate_payout_status', ['pending', 'paid', 'failed'])

export const payouts = pgTable(
  'payouts',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    affiliateId: bigint('affiliate_id', { mode: 'number' })
      .notNull()
      .references(() => affiliates.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    amount: numeric('amount', { precision: 19, scale: 4 }).notNull(),
    currency: char('currency', { length: 3 }).notNull().default('ETB'),
    method: varchar('method', { length: 60 }).notNull(),
    status: payoutStatusPgEnum().notNull().default('pending'),
    reference: varchar('reference', { length: 200 }),
    notes: text('notes'),
    processedBy: text('processed_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_payouts_public').on(table.publicId),
    index('idx_payouts_affiliate').on(table.affiliateId, table.createdAt),
    index('idx_payouts_status').on(table.status),
    check('payout_amount_check', sql`${table.amount} > 0`),
  ],
)

export const affiliatesRelations = relations(affiliates, ({ one, many }) => ({
  user: one(users, {
    fields: [affiliates.userId],
    references: [users.id],
  }),
  decider: one(users, {
    fields: [affiliates.decidedBy],
    references: [users.id],
    relationName: 'affiliate_decider',
  }),
  links: many(affiliateLinks),
  events: many(affiliateEvents),
  commissions: many(commissions),
  payouts: many(payouts),
}))

export const affiliateLinksRelations = relations(affiliateLinks, ({ one }) => ({
  affiliate: one(affiliates, {
    fields: [affiliateLinks.affiliateId],
    references: [affiliates.id],
  }),
  course: one(courses, {
    fields: [affiliateLinks.courseId],
    references: [courses.id],
  }),
}))

export const affiliateEventsRelations = relations(affiliateEvents, ({ one }) => ({
  affiliate: one(affiliates, {
    fields: [affiliateEvents.affiliateId],
    references: [affiliates.id],
  }),
  link: one(affiliateLinks, {
    fields: [affiliateEvents.linkId],
    references: [affiliateLinks.id],
  }),
}))

export const commissionsRelations = relations(commissions, ({ one }) => ({
  affiliate: one(affiliates, {
    fields: [commissions.affiliateId],
    references: [affiliates.id],
  }),
  purchase: one(purchases, {
    fields: [commissions.purchaseId],
    references: [purchases.id],
  }),
}))

export const payoutsRelations = relations(payouts, ({ one, many }) => ({
  affiliate: one(affiliates, {
    fields: [payouts.affiliateId],
    references: [affiliates.id],
  }),
  processor: one(users, {
    fields: [payouts.processedBy],
    references: [users.id],
  }),
  commissions: many(commissions),
}))

export const insertAffiliateSchema = createInsertSchema(affiliates, {
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  status: affiliateStatusEnum.default('pending'),
  audience: z.string().max(2_000).nullable().optional(),
  channels: z.string().max(2_000).nullable().optional(),
}).omit({ publicId: true })
export const selectAffiliateSchema = createSelectSchema(affiliates)
export type InsertAffiliate = z.infer<typeof insertAffiliateSchema>
export type SelectAffiliate = z.infer<typeof selectAffiliateSchema>

export const insertCommissionSchema = createInsertSchema(commissions, {
  rate: z.number().min(0).max(100),
  amount: z.number().min(0),
  status: commissionStatusEnum.default('pending'),
}).omit({ publicId: true })
export type InsertCommission = z.infer<typeof insertCommissionSchema>

export const insertPayoutSchema = createInsertSchema(payouts, {
  amount: z.number().positive(),
  method: z.string().trim().min(1).max(60),
  status: payoutStatusEnum.default('pending'),
}).omit({ publicId: true })
export type InsertPayout = z.infer<typeof insertPayoutSchema>
