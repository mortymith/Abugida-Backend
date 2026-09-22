import {
  bigint,
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  boolean,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'

/**
 * Gamification badges (spec 06 S-4.7): milestone rewards with an automatic
 * trigger (first lesson completed, streak ≥ N days, quiz score = 100%,
 * course completed) or manual awarding. One trigger per badge; names are
 * unique per workspace among non-deleted badges.
 */
export const badgeTriggerEnum = z.enum([
  'first_lesson',
  'streak',
  'quiz_perfect',
  'course_completed',
  'manual',
])
export type BadgeTrigger = z.infer<typeof badgeTriggerEnum>
export const badgeTriggerPgEnum = pgEnum('badge_trigger', [
  'first_lesson',
  'streak',
  'quiz_perfect',
  'course_completed',
  'manual',
])

export const badgeStatusEnum = z.enum(['active', 'paused', 'archived'])
export type BadgeStatus = z.infer<typeof badgeStatusEnum>
export const badgeStatusPgEnum = pgEnum('badge_status', ['active', 'paused', 'archived'])

export const badgeAwardSourceEnum = z.enum(['automatic', 'manual'])
export type BadgeAwardSource = z.infer<typeof badgeAwardSourceEnum>
export const badgeAwardSourcePgEnum = pgEnum('badge_award_source', ['automatic', 'manual'])

export const triggerConfigSchema = z
  .object({
    /** Streak trigger only: required consecutive activity days. */
    days: z.number().int().min(1).max(365).optional(),
  })
  .strict()
export type BadgeTriggerConfig = z.infer<typeof triggerConfigSchema>

export const badges = pgTable(
  'badges',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    /** Emoji icon shown in the grid and on student surfaces (e.g. 🥇). */
    icon: varchar('icon', { length: 16 }),
    triggerKind: badgeTriggerPgEnum().notNull(),
    triggerConfig: jsonb('trigger_config').$type<BadgeTriggerConfig>().notNull().default({}),
    notifyStudent: boolean('notify_student').notNull().default(true),
    status: badgeStatusPgEnum().notNull().default('active'),
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
    uniqueIndex('idx_badges_public').on(table.publicId),
    index('idx_badges_status').on(table.status),
    // Unique name per workspace among live badges; archiving frees the name.
    uniqueIndex('idx_badges_unique_name')
      .on(table.name)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
)

export const awardedBadges = pgTable(
  'awarded_badges',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    badgeId: bigint('badge_id', { mode: 'number' })
      .notNull()
      .references(() => badges.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    source: badgeAwardSourcePgEnum().notNull(),
    awardedBy: text('awarded_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    note: varchar('note', { length: 500 }),
    awardedAt: timestamp('awarded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_awarded_badges_public').on(table.publicId),
    // One award per badge per student — pausing never revokes history.
    uniqueIndex('idx_awarded_badges_unique').on(table.badgeId, table.studentId),
    index('idx_awarded_badges_student').on(table.studentId, table.awardedAt),
    index('idx_awarded_badges_badge').on(table.badgeId, table.awardedAt),
  ],
)

export const badgesRelations = relations(badges, ({ many }) => ({
  awards: many(awardedBadges),
}))

export const awardedBadgesRelations = relations(awardedBadges, ({ one }) => ({
  badge: one(badges, {
    fields: [awardedBadges.badgeId],
    references: [badges.id],
  }),
  student: one(users, {
    fields: [awardedBadges.studentId],
    references: [users.id],
  }),
}))

export const insertBadgeSchema = createInsertSchema(badges, {
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2_000).nullable().optional(),
  icon: z.string().trim().max(16).nullable().optional(),
  triggerConfig: triggerConfigSchema.default({}),
}).omit({ publicId: true, createdAt: true, updatedAt: true, deletedAt: true })
export const selectBadgeSchema = createSelectSchema(badges)
export type InsertBadge = z.infer<typeof insertBadgeSchema>
export type SelectBadge = z.infer<typeof selectBadgeSchema>
