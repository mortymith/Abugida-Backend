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

export const insertOrganizationSchema = createInsertSchema(organization)
export const selectOrganizationSchema = createSelectSchema(organization)
export const updateOrganizationSchema = createUpdateSchema(organization).partial()
export const insertMemberSchema = createInsertSchema(member)
export const selectMemberSchema = createSelectSchema(member)
export const updateMemberSchema = createUpdateSchema(member).partial()
export const insertInvitationSchema = createInsertSchema(invitation)
export const selectInvitationSchema = createSelectSchema(invitation)
export const updateInvitationSchema = createUpdateSchema(invitation).partial()

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>
export type SelectOrganization = z.infer<typeof selectOrganizationSchema>
export type UpdateOrganization = z.infer<typeof updateOrganizationSchema>
export type InsertMember = z.infer<typeof insertMemberSchema>
export type SelectMember = z.infer<typeof selectMemberSchema>
export type UpdateMember = z.infer<typeof updateMemberSchema>
export type InsertInvitation = z.infer<typeof insertInvitationSchema>
export type SelectInvitation = z.infer<typeof selectInvitationSchema>
export type UpdateInvitation = z.infer<typeof updateInvitationSchema>
