import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  jsonb,
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
import { emailTemplates, emailTemplateVersions } from './email-templates'

/**
 * Email campaigns (spec 10 S-8.1). Lifecycle: draft → scheduled → sending →
 * sent, with cancel allowed only while scheduled. The audience is a stored
 * segment description resolved server-side at send time with consent
 * suppression (marketing consent, unsubscribes, bounces). Per-recipient
 * sends and provider events back the delivered → opened → clicked →
 * enrolled funnel and link-level click breakdowns.
 */

export const campaignStatusEnum = z.enum(['draft', 'scheduled', 'sending', 'sent', 'cancelled'])
export type CampaignStatus = z.infer<typeof campaignStatusEnum>
export const campaignStatusPgEnum = pgEnum('campaign_status', [
  'draft',
  'scheduled',
  'sending',
  'sent',
  'cancelled',
])

/**
 * Audience segment description (S-8.1 segment builder). Every field is an
 * additional filter; empty object = all contacts. Resolution always ANDs
 * the marketing-consent requirement — it is intentionally not expressible
 * here so it can never be opted out of by client data.
 */
export const campaignAudienceSchema = z
  .object({
    /** Cohort public ids (S-4.4). */
    cohortPublicIds: z.array(z.string().uuid()).max(50).default([]),
    /** Course public ids — students enrolled in any of these courses. */
    coursePublicIds: z.array(z.string().uuid()).max(100).default([]),
    /** Free-form student tags (S-4.8). */
    tags: z.array(z.string().min(1).max(60)).max(30).default([]),
    /** Enrollment-activity filter over the scoped population. */
    activity: z.enum(['any', 'active_30d', 'inactive_30d', 'completed']).default('any'),
  })
  .strict()
export type CampaignAudience = z.infer<typeof campaignAudienceSchema>

export const campaigns = pgTable(
  'campaigns',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    name: varchar('name', { length: 200 }).notNull(),
    subject: varchar('subject', { length: 150 }).notNull(),
    preheader: varchar('preheader', { length: 300 }),
    templateId: bigint('template_id', { mode: 'number' }).references(() => emailTemplates.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    /** Version the campaign pins when it starts composing a send. */
    templateVersionId: bigint('template_version_id', { mode: 'number' }).references(
      () => emailTemplateVersions.id,
      { onDelete: 'set null', onUpdate: 'cascade' },
    ),
    audience: jsonb('audience').$type<CampaignAudience>().notNull(),
    status: campaignStatusPgEnum().notNull().default('draft'),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    /** Recipient snapshot captured when the send fired (reporting stability). */
    recipientCount: integer('recipient_count'),
    duplicatedFromId: bigint('duplicated_from_id', { mode: 'number' }),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_campaigns_public').on(table.publicId),
    index('idx_campaigns_status').on(table.status, table.scheduledFor),
    index('idx_campaigns_created').on(table.createdAt),
    check(
      'campaign_schedule_future_check',
      sql`${table.scheduledFor} IS NULL OR ${table.sentAt} IS NULL`,
    ),
  ],
)

export const campaignSendStatusEnum = z.enum(['queued', 'sent', 'failed', 'skipped'])
export type CampaignSendStatus = z.infer<typeof campaignSendStatusEnum>
export const campaignSendStatusPgEnum = pgEnum('campaign_send_status', [
  'queued',
  'sent',
  'failed',
  'skipped',
])

/** One row per resolved recipient of a campaign send. */
export const campaignSends = pgTable(
  'campaign_sends',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    campaignId: bigint('campaign_id', { mode: 'number' })
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    /** Email snapshot — keeps metrics stable if the account later changes. */
    email: varchar('email', { length: 320 }).notNull(),
    status: campaignSendStatusPgEnum().notNull().default('queued'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_campaign_sends_public').on(table.publicId),
    uniqueIndex('idx_campaign_sends_recipient').on(table.campaignId, table.email),
    index('idx_campaign_sends_campaign_status').on(table.campaignId, table.status),
    index('idx_campaign_sends_user').on(table.userId),
  ],
)

export const campaignEventTypeEnum = z.enum([
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'unsubscribed',
])
export type CampaignEventType = z.infer<typeof campaignEventTypeEnum>
export const campaignEventTypePgEnum = pgEnum('campaign_event_type', [
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'unsubscribed',
])

/**
 * Provider events per recipient (webhook ingestion writes here). Opens are
 * deduplicated by (send, type, day); clicks are per link so link-level
 * breakdowns stay reproducible.
 */
export const campaignEvents = pgTable(
  'campaign_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    campaignId: bigint('campaign_id', { mode: 'number' })
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    sendId: bigint('send_id', { mode: 'number' }).references(() => campaignSends.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    email: varchar('email', { length: 320 }).notNull(),
    eventType: campaignEventTypePgEnum().notNull(),
    linkUrl: text('link_url'),
    linkLabel: varchar('link_label', { length: 200 }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_campaign_events_public').on(table.publicId),
    index('idx_campaign_events_funnel').on(table.campaignId, table.eventType),
    index('idx_campaign_events_link').on(table.campaignId, table.linkUrl),
    index('idx_campaign_events_send').on(table.sendId),
  ],
)

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  template: one(emailTemplates, {
    fields: [campaigns.templateId],
    references: [emailTemplates.id],
  }),
  templateVersion: one(emailTemplateVersions, {
    fields: [campaigns.templateVersionId],
    references: [emailTemplateVersions.id],
  }),
  author: one(users, {
    fields: [campaigns.createdBy],
    references: [users.id],
  }),
  sends: many(campaignSends),
  events: many(campaignEvents),
}))

export const campaignSendsRelations = relations(campaignSends, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [campaignSends.campaignId],
    references: [campaigns.id],
  }),
  user: one(users, {
    fields: [campaignSends.userId],
    references: [users.id],
  }),
  events: many(campaignEvents),
}))

export const campaignEventsRelations = relations(campaignEvents, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignEvents.campaignId],
    references: [campaigns.id],
  }),
  send: one(campaignSends, {
    fields: [campaignEvents.sendId],
    references: [campaignSends.id],
  }),
}))

export const insertCampaignSchema = createInsertSchema(campaigns, {
  name: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(150),
  preheader: z.string().max(300).nullable().optional(),
  audience: campaignAudienceSchema,
  status: campaignStatusEnum.default('draft'),
  scheduledFor: z.date().nullable().optional(),
}).omit({ publicId: true, recipientCount: true, duplicatedFromId: true })
export const selectCampaignSchema = createSelectSchema(campaigns)
export type InsertCampaign = z.infer<typeof insertCampaignSchema>
export type SelectCampaign = z.infer<typeof selectCampaignSchema>

export const insertCampaignSendSchema = createInsertSchema(campaignSends, {
  email: z.string().email().max(320),
  status: campaignSendStatusEnum.default('queued'),
}).omit({ publicId: true })
export const selectCampaignSendSchema = createSelectSchema(campaignSends)
export type InsertCampaignSend = z.infer<typeof insertCampaignSendSchema>
export type SelectCampaignSend = z.infer<typeof selectCampaignSendSchema>
