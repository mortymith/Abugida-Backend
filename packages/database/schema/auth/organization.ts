import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from './users'

/**
 * Better Auth `organization` plugin tables.
 *
 * These tables are managed by Better Auth (ids are supplied by the library,
 * never app-side defaults). The dashboard uses `member.role` as the source of
 * truth for the platform role: `owner` | `admin` map to the admin console's
 * `admin`, while `editor`, `viewer`, and `support` are used verbatim (see
 * `app/dashboard/src/features/auth/auth.roles.ts`).
 */
export const organization = pgTable(
  'organization',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    logo: text('logo'),
    metadata: text('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('idx_organization_slug').on(table.slug)],
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
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_member_organization_id').on(table.organizationId),
    index('idx_member_user_id').on(table.userId),
    uniqueIndex('idx_member_org_user').on(table.organizationId, table.userId),
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
    role: text('role'),
    status: text('status').notNull().default('pending'),
    inviterId: text('inviter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
  },
  (table) => [
    index('idx_invitation_organization_id').on(table.organizationId),
    index('idx_invitation_email').on(table.email),
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

export const insertOrganizationSchema = createInsertSchema(organization, {
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
})
export const selectOrganizationSchema = createSelectSchema(organization)
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>
export type SelectOrganization = z.infer<typeof selectOrganizationSchema>

export const insertMemberSchema = createInsertSchema(member, {
  role: z.string().min(1).default('member'),
})
export const selectMemberSchema = createSelectSchema(member)
export type InsertMember = z.infer<typeof insertMemberSchema>
export type SelectMember = z.infer<typeof selectMemberSchema>
