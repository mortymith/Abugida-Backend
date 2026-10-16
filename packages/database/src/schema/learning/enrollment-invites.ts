import {
  pgTable,
  bigint,
  uuid,
  text,
  varchar,
  timestamp,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { organization } from '../auth/organization'
import { courses } from '../catalog/courses'
import { cohorts } from './cohorts'
import { users } from '../auth/users'

/**
 * Course-scoped claimable enrollment invites (spec 06 S-4.1 — Add Student
 * no longer collects a name or email; it issues a claimable link or an
 * 8-character code).
 *
 * Distinct from the org-scoped `auth/organization.ts::invite_link` table:
 * an enrollment invite ties to a **specific course** (and optional cohort),
 * expires in 7 days, is single-use, and carries both a token (for the URL)
 * and a codeHash (for the 8-char code). The student's name is captured
 * after sign-in, from their identity — the inviter never types it.
 *
 * The token and code are stored as SHA-256 hashes (never plaintext) so a
 * database leak does not reveal claimable invites. The plaintext token is
 * returned once at creation time and embedded in the URL; the plaintext
 * code is shown once and copied by the inviter.
 */
export const enrollmentInviteStatusEnum = z.enum(['pending', 'claimed', 'expired', 'cancelled'])
export type EnrollmentInviteStatus = z.infer<typeof enrollmentInviteStatusEnum>
export const enrollmentInviteStatusPgEnum = pgEnum('enrollment_invite_status', [
  'pending',
  'claimed',
  'expired',
  'cancelled',
])

export const enrollmentInvites = pgTable(
  'enrollment_invites',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    /** Optional cohort to assign the student to on claim. */
    cohortId: bigint('cohort_id', { mode: 'number' }).references(() => cohorts.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    /** SHA-256 hash of the URL token. The plaintext token is returned once at creation. */
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    /** SHA-256 hash of the 8-character code. The plaintext code is shown once at creation. */
    codeHash: varchar('code_hash', { length: 64 }).notNull(),
    status: enrollmentInviteStatusPgEnum().notNull().default('pending'),
    /** 7-day expiry (spec 06 S-4.1). */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    claimedByUserId: text('claimed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_enrollment_invites_public').on(table.publicId),
    uniqueIndex('idx_enrollment_invites_token').on(table.tokenHash),
    uniqueIndex('idx_enrollment_invites_code').on(table.codeHash),
    index('idx_enrollment_invites_org_status').on(table.organizationId, table.status),
    index('idx_enrollment_invites_course').on(table.courseId, table.status),
    index('idx_enrollment_invites_creator').on(table.createdBy, table.status),
    /** Partial index for the expiry sweep worker: pending invites past expiry. */
    index('idx_enrollment_invites_expiry_sweep')
      .on(table.expiresAt)
      .where(sql`${table.status} = 'pending'`),
  ],
)

export const enrollmentInvitesRelations = relations(enrollmentInvites, ({ one }) => ({
  organization: one(organization, {
    fields: [enrollmentInvites.organizationId],
    references: [organization.id],
  }),
  course: one(courses, {
    fields: [enrollmentInvites.courseId],
    references: [courses.id],
  }),
  cohort: one(cohorts, {
    fields: [enrollmentInvites.cohortId],
    references: [cohorts.id],
  }),
  claimer: one(users, {
    fields: [enrollmentInvites.claimedByUserId],
    references: [users.id],
    relationName: 'enrollment_invite_claimer',
  }),
  creator: one(users, {
    fields: [enrollmentInvites.createdBy],
    references: [users.id],
    relationName: 'enrollment_invite_creator',
  }),
}))

export const insertEnrollmentInviteSchema = createInsertSchema(enrollmentInvites, {
  courseId: z.number().positive(),
  cohortId: z.number().positive().nullable().optional(),
  tokenHash: z.string().length(64),
  codeHash: z.string().length(64),
  status: enrollmentInviteStatusEnum.default('pending'),
  expiresAt: z.date(),
}).omit({
  publicId: true,
})
export const selectEnrollmentInviteSchema = createSelectSchema(enrollmentInvites)
export const updateEnrollmentInviteSchema = insertEnrollmentInviteSchema.partial()
export type InsertEnrollmentInvite = z.infer<typeof insertEnrollmentInviteSchema>
export type SelectEnrollmentInvite = z.infer<typeof selectEnrollmentInviteSchema>
export type UpdateEnrollmentInvite = z.infer<typeof updateEnrollmentInviteSchema>
