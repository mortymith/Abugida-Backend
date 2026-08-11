import {
  pgTable,
  bigint,
  uuid,
  varchar,
  jsonb,
  boolean,
  smallint,
  timestamp,
  uniqueIndex,
  check,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from './users'
import { bytea } from '../shared/custom-types'
export const educationSegmentEnum = z.enum(['toefl', 'igcse', 'high_school', 'college'])
export type EducationSegment = z.infer<typeof educationSegmentEnum>
export const educationSegmentPgEnum = pgEnum('education_segment', [
  'toefl',
  'igcse',
  'high_school',
  'college',
])
export const userProfiles = pgTable(
  'user_profiles',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .unique()
      .references(() => users.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    avatarObjectKey: varchar('avatar_object_key', { length: 500 }),
    emailEncrypted: bytea('email_encrypted'),
    emailHash: varchar('email_hash', { length: 64 }).unique(),
    educationSegment: educationSegmentPgEnum(),
    notificationPreferences: jsonb('notification_preferences').notNull().default({}),
    languagePreference: varchar('language_preference', { length: 10 }).notNull().default('en'),
    timezone: varchar('timezone', { length: 50 }).notNull().default('Africa/Addis_Ababa'),
    examPreferences: jsonb('exam_preferences').notNull().default([]),
    isOnboardingCompleted: boolean('is_onboarding_completed').notNull().default(false),
    onboardingStep: smallint('onboarding_step').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_user_profiles_public').on(table.publicId),
    uniqueIndex('idx_user_profiles_user').on(table.userId),
    uniqueIndex('idx_user_profiles_email_hash').on(table.emailHash),

    check(
      'onboarding_step_check',
      sql`${table.onboardingStep} >= 0 AND ${table.onboardingStep} <= 5`,
    ),
  ],
)
export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}))
export const insertUserProfileSchema = createInsertSchema(userProfiles, {
  notificationPreferences: z.record(z.string(), z.unknown()).default({}),
  examPreferences: z.array(z.unknown()).default([]),
  educationSegment: educationSegmentEnum.nullable().optional(),
  languagePreference: z.string().min(2).max(10).default('en'),
  timezone: z.string().min(1).max(50).default('Africa/Addis_Ababa'),
  onboardingStep: z.number().int().min(0).max(5).default(0),
  isOnboardingCompleted: z.boolean().default(false),
}).omit({
  publicId: true,
})
export const selectUserProfileSchema = createSelectSchema(userProfiles)
export const updateUserProfileSchema = insertUserProfileSchema.partial()
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>
export type SelectUserProfile = z.infer<typeof selectUserProfileSchema>
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>
