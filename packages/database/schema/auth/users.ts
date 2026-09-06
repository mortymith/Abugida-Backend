import {
  pgTable,
  text,
  varchar,
  char,
  boolean,
  integer,
  smallint,
  timestamp,
  check,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { sql, relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod'
import { z } from 'zod'
import { bytea } from '../shared/custom-types'
import { userProfiles } from './user-profiles'
import { devices } from './devices'
import { userConsents } from './user-consents'
import { session } from './session'
import { account } from './account'
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

/**
 * Central identity table (auth.users).
 *
 * Columns are grouped by owner:
 *
 *  - Better Auth-owned (`id`, `name`, `email`, `email_verified`, `image`,
 *    `created_at`, `updated_at`): written exclusively by Better Auth. The
 *    `$defaultFn` on `id` only covers app-side inserts (seeds, tests); Better
 *    Auth always supplies its own.
 *  - App-owned extensions: optional with DB defaults so Better Auth inserts
 *    never need to provide them.
 *
 * Deletion lifecycle (GDPR): deletionRequestedAt → grace period →
 * deletionCompletedAt → retentionExpiresAt → PII purge (name/email/phone/
 * image nulled, which also frees the unique email/phone values for
 * re-registration). The lifecycle CHECKs below enforce that no lifecycle
 * timestamp is set before `deletion_requested_at`.
 */
export const users = pgTable(
  'users',
  {
    // ── Better Auth-owned ────────────────────────────────────────────────────
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name'),
    email: text('email'),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),

    // ── App-owned: phone (PII-safe trio, all set or all null) ────────────────
    phoneNumberEncrypted: bytea('phone_number_encrypted'),
    phoneNumberHash: varchar('phone_number_hash', { length: 64 }),
    phoneNumberLast4: char('phone_number_last4', { length: 4 }),
    hashVersion: smallint('hash_version').notNull().default(1),

    // ── App-owned: device policy ─────────────────────────────────────────────
    deviceCount: integer('device_count').notNull().default(0),
    maxDevices: integer('max_devices').notNull().default(3),

    // ── App-owned: account state ─────────────────────────────────────────────
    accountStatus: accountStatusPgEnum('account_status').notNull().default('active'),
    failedLoginAttempts: smallint('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),

    // ── App-owned: deletion lifecycle ────────────────────────────────────────
    deletionRequestedAt: timestamp('deletion_requested_at', { withTimezone: true }),
    deletionCompletedAt: timestamp('deletion_completed_at', { withTimezone: true }),
    retentionExpiresAt: timestamp('retention_expires_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    // Email uniqueness stays a full (non-partial) index on purpose: Better
    // Auth's findUserByEmail does not filter `deleted_at IS NULL`, so Postgres
    // could not use a partial index for that lookup.
    uniqueIndex('idx_users_email').on(table.email),
    uniqueIndex('idx_users_phone_hash').on(table.phoneNumberHash),

    // Status lookups always co-filter soft-deleted rows.
    index('idx_users_status').on(table.accountStatus, table.deletedAt),

    // Sweep indexes: partial, so they only contain rows a job can act on.
    index('idx_users_deleted')
      .on(table.deletedAt)
      .where(sql`${table.deletedAt} IS NOT NULL`),
    index('idx_users_deletion_sla')
      .on(table.deletionRequestedAt)
      .where(sql`${table.deletionRequestedAt} IS NOT NULL`),
    index('idx_users_retention')
      .on(table.retentionExpiresAt)
      .where(sql`${table.retentionExpiresAt} IS NOT NULL`),

    // ── Integrity: phone trio is all-or-nothing ──────────────────────────────
    check(
      'users_phone_trio_check',
      sql`(${table.phoneNumberEncrypted} IS NULL) = (${table.phoneNumberHash} IS NULL)
          AND (${table.phoneNumberLast4} IS NULL) = (${table.phoneNumberHash} IS NULL)`,
    ),
    // ── Integrity: deletion lifecycle ordering ───────────────────────────────
    check(
      'users_deleted_after_request_check',
      sql`${table.deletedAt} IS NULL OR ${table.deletionRequestedAt} IS NOT NULL`,
    ),
    check(
      'users_completion_after_request_check',
      sql`${table.deletionCompletedAt} IS NULL OR ${table.deletionRequestedAt} IS NOT NULL`,
    ),
    check(
      'users_retention_after_request_check',
      sql`${table.retentionExpiresAt} IS NULL OR ${table.deletionRequestedAt} IS NOT NULL`,
    ),
    // ── Integrity: domain ranges (mirror the zod layer) ──────────────────────
    check('failed_login_attempts_check', sql`${table.failedLoginAttempts} >= 0`),
    check('users_device_count_check', sql`${table.deviceCount} >= 0`),
    check('users_max_devices_check', sql`${table.maxDevices} BETWEEN 1 AND 10`),
    check('users_hash_version_check', sql`${table.hashVersion} >= 1`),
  ],
)

export const usersRelations = relations(users, ({ many, one }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  sessions: many(session),
  accounts: many(account),
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
  name: z.string().max(100).nullable().optional(),
  phoneNumberEncrypted: z.instanceof(Buffer).nullable().optional(),
  phoneNumberHash: z.string().max(64).nullable().optional(),
  phoneNumberLast4: z.string().length(4).nullable().optional(),
  accountStatus: accountStatusEnum.default('active'),
  email: z.string().email().nullable().optional(),
  emailVerified: z.boolean().default(false),
  image: z.string().url().nullable().optional(),
  maxDevices: z.number().int().min(1).max(10).default(3),
  deviceCount: z.number().int().min(0).default(0),
  failedLoginAttempts: z.number().int().min(0).default(0),
})
  .omit({ id: true })
  .refine(
    (v) => {
      const provided = [v.phoneNumberEncrypted, v.phoneNumberHash, v.phoneNumberLast4].filter(
        (p) => p !== null && p !== undefined,
      ).length
      return provided === 0 || provided === 3
    },
    { message: 'Phone fields must be provided together (encrypted value, hash, last4).' },
  )
export const selectUserSchema = createSelectSchema(users)
export const updateUserSchema = createUpdateSchema(users)
export type InsertUser = z.infer<typeof insertUserSchema>
export type SelectUser = z.infer<typeof selectUserSchema>
export type UpdateUser = z.infer<typeof updateUserSchema>
