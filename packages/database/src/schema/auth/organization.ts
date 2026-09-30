import { relations } from 'drizzle-orm'
import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod'
import { z } from 'zod'

import { users } from './users'

export const organization = pgTable(
  'organization',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    useCase: text('use_case').notNull(),
    logo: text('logo'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_organization_slug').on(table.slug)],
)

export const member = pgTable(
  'member',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_member_organization_user').on(table.organizationId, table.userId),
    index('idx_member_user_id').on(table.userId),
  ],
)

export const invitation = pgTable(
  'invitation',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull(),
    status: text('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    inviterId: text('inviter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('idx_invitation_organization_id').on(table.organizationId),
    index('idx_invitation_email').on(table.email),
    index('idx_invitation_status').on(table.status),
  ],
)

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
  inviteLinks: many(inviteLink),
}))

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(users, {
    fields: [member.userId],
    references: [users.id],
  }),
}))

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  inviter: one(users, {
    fields: [invitation.inviterId],
    references: [users.id],
  }),
}))

/**
 * A claimable invite (spec `13` § GAP-2, `11` § Notification Delivery).
 *
 * **This is a sibling of `invitation`, not a widened `invitation`.** GAP-2
 * originally read "make `email` nullable and add `handle` + `token`", and
 * that fix is not safe: Better Auth's organization plugin owns `invitation` and
 * dereferences `invitation.email.toLowerCase()` unguarded on loaded rows in
 * `accept-invite`, `reject-invite` and `cancel-invite`
 * (`better-auth/dist/plugins/organization/routes/crud-invites.mjs`). A null
 * email is a `TypeError` on all three — a 500 on a working feature, in code
 * that ships prebuilt and so never fails our typecheck. Keeping `invitation`
 * exactly as Better Auth defines it means the email path is untouched and there
 * is nothing to re-apply on upgrade.
 *
 * What this table adds is the thing the email path cannot express: an invite
 * claimable by a user who has no email address at all.
 *
 * Security notes:
 *  - `tokenHash` stores a SHA-256 digest, never the token. A database leak
 *    therefore yields no usable invite links. The raw value is returned once at
 *    issue time and never again.
 *  - `tokenHash` and `codeHash` are both unique, so a duplicate is a constraint
 *    violation at insert rather than an ambiguous lookup at claim time.
 *  - A claim is decided by one conditional `UPDATE ... RETURNING`, so two people
 *    racing on the same link produce exactly one winner.
 */
export const inviteLink = pgTable(
  'invite_link',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    /** Role granted on claim, in Better Auth's own vocabulary. */
    role: text('role').notNull().default('member'),
    /** Optional email, for a workspace that wants to pre-bind the invite. */
    email: text('email'),
    /** Telegram handle, for the no-email case this table exists to serve. */
    handle: text('handle'),
    /** SHA-256 of the long opaque link token. The token itself is never stored. */
    tokenHash: text('token_hash').notNull(),
    /** SHA-256 of the 8-character code, for Telegram-safe manual entry. */
    codeHash: text('code_hash'),
    status: text('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    claimedByUserId: text('claimed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    inviterId: text('inviter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_invite_link_token_hash').on(table.tokenHash),
    uniqueIndex('idx_invite_link_code_hash').on(table.codeHash),
    index('idx_invite_link_organization_id').on(table.organizationId),
    index('idx_invite_link_status').on(table.status),
    index('idx_invite_link_handle').on(table.handle),
  ],
)

export const inviteLinkRelations = relations(inviteLink, ({ one }) => ({
  organization: one(organization, {
    fields: [inviteLink.organizationId],
    references: [organization.id],
  }),
  inviter: one(users, {
    fields: [inviteLink.inviterId],
    references: [users.id],
  }),
  claimedBy: one(users, {
    fields: [inviteLink.claimedByUserId],
    references: [users.id],
  }),
}))

export const insertOrganizationSchema = createInsertSchema(organization)
export const selectOrganizationSchema = createSelectSchema(organization)
export const updateOrganizationSchema = createUpdateSchema(organization).partial()
export const insertMemberSchema = createInsertSchema(member)
export const selectMemberSchema = createSelectSchema(member)
export const updateMemberSchema = createUpdateSchema(member).partial()
export const insertInvitationSchema = createInsertSchema(invitation)
export const selectInvitationSchema = createSelectSchema(invitation)
export const updateInvitationSchema = createUpdateSchema(invitation).partial()
export const insertInviteLinkSchema = createInsertSchema(inviteLink)
export const selectInviteLinkSchema = createSelectSchema(inviteLink)
export const updateInviteLinkSchema = createUpdateSchema(inviteLink).partial()

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>
export type SelectOrganization = z.infer<typeof selectOrganizationSchema>
export type UpdateOrganization = z.infer<typeof updateOrganizationSchema>
export type InsertMember = z.infer<typeof insertMemberSchema>
export type SelectMember = z.infer<typeof selectMemberSchema>
export type UpdateMember = z.infer<typeof updateMemberSchema>
export type InsertInvitation = z.infer<typeof insertInvitationSchema>
export type SelectInvitation = z.infer<typeof selectInvitationSchema>
export type UpdateInvitation = z.infer<typeof updateInvitationSchema>
export type InsertInviteLink = z.infer<typeof insertInviteLinkSchema>
export type SelectInviteLink = z.infer<typeof selectInviteLinkSchema>
export type UpdateInviteLink = z.infer<typeof updateInviteLinkSchema>
