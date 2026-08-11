import {
  pgTable,
  bigint,
  uuid,
  varchar,
  char,
  integer,
  smallint,
  timestamp,
  check,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod'
import { z } from 'zod'
import { bytea } from '../shared/custom-types'
import { userProfiles } from './user-profiles'
import { devices } from './devices'
import { userConsents } from './user-consents'
import { courses } from '../catalog/courses'
import { enrollments } from '../learning/enrollments'
import { courseRoles } from '../ops/course-roles'
import { auditLogs } from '../ops/audit-logs'
import { securityEvents } from '../ops/security-events'
export const accountStatusEnum = z.enum([
  'pending_verification',
  'active',
  'locked',
  'suspended',
  'deleted',
])
export type AccountStatus = z.infer<typeof accountStatusEnum>
export const accountStatusPgEnum = pgEnum('account_status', [
  'pending_verification',
  'active',
  'locked',
  'suspended',
  'deleted',
])
export const users = pgTable(
  'users',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    phoneNumberEncrypted: bytea('phone_number_encrypted'),
    phoneNumberHash: varchar('phone_number_hash', { length: 64 }),
    phoneNumberLast4: char('phone_number_last4', { length: 4 }),
    hashVersion: smallint('hash_version').default(1),
    deviceCount: integer('device_count').notNull().default(0),
    maxDevices: integer('max_devices').notNull().default(3),
    displayName: varchar('display_name', { length: 100 }),
    accountStatus: accountStatusPgEnum().default('active'),
    failedLoginAttempts: smallint('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    deletionRequestedAt: timestamp('deletion_requested_at', {
      withTimezone: true,
    }),
    deletionCompletedAt: timestamp('deletion_completed_at', {
      withTimezone: true,
    }),
    retentionExpiresAt: timestamp('retention_expires_at', {
      withTimezone: true,
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_users_public_id').on(table.publicId),
    uniqueIndex('idx_users_phone_hash').on(table.phoneNumberHash),
    index('idx_users_status').on(table.accountStatus),
    index('idx_users_deleted').on(table.deletedAt),
    index('idx_users_deletion_sla').on(table.deletionRequestedAt),
    index('idx_users_retention').on(table.retentionExpiresAt),

    check('failed_login_attempts_check', sql`${table.failedLoginAttempts} >= 0`),
  ],
)
export const usersRelations = relations(users, ({ many, one }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  devices: many(devices),
  consents: many(userConsents),
  courses: many(courses, {
    relationName: 'instructor_courses',
  }),
  enrollments: many(enrollments, {
    relationName: 'student_enrollments',
  }),
  courseRoles: many(courseRoles),
  auditLogs: many(auditLogs),
  securityEvents: many(securityEvents),
}))
export const insertUserSchema = createInsertSchema(users, {
  phoneNumberEncrypted: z.instanceof(Buffer).nullable().optional(),
  phoneNumberHash: z.string().max(64).nullable().optional(),
  phoneNumberLast4: z.string().length(4).nullable().optional(),
  accountStatus: accountStatusEnum,
  displayName: z.string().max(100).nullable().optional(),
  maxDevices: z.number().int().min(1).max(10).default(3),
  deviceCount: z.number().int().min(0).default(0),
  failedLoginAttempts: z.number().int().min(0).default(0),
}).omit({
  publicId: true,
})
export const selectUserSchema = createSelectSchema(users)
export const updateUserSchema = createUpdateSchema(users).partial()
export type InsertUser = z.infer<typeof insertUserSchema>
export type SelectUser = z.infer<typeof selectUserSchema>
export type UpdateUser = z.infer<typeof updateUserSchema>
