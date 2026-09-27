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

/**
 * Email templates and template versions (spec 10 S-8.2). Campaigns (S-8.1)
 * and student automations (S-4.8) compose from the published version they
 * pin at send time. Blocks are a structured, ordered list rendered by the
 * template editor's live preview; the unsubscribe footer block is mandatory.
 */

export const templateKindEnum = z.enum([
  'welcome',
  'announcement',
  'reminder',
  'promotion',
  'certificate_issued',
  're_engagement',
  'custom',
])
export type TemplateKind = z.infer<typeof templateKindEnum>
export const templateKindPgEnum = pgEnum('email_template_kind', [
  'welcome',
  'announcement',
  'reminder',
  'promotion',
  'certificate_issued',
  're_engagement',
  'custom',
])

export const emailBlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hero'),
    heading: z.string().trim().min(1).max(200),
    subheading: z.string().trim().max(300).nullable().optional(),
  }),
  z.object({
    type: z.literal('text'),
    body: z.string().trim().min(1).max(5_000),
  }),
  z.object({
    type: z.literal('button'),
    label: z.string().trim().min(1).max(80),
    url: z.string().min(1).max(2_000),
  }),
  z.object({
    type: z.literal('course_card'),
    /** Public id of the course to feature; null renders a placeholder. */
    coursePublicId: z.string().uuid().nullable().optional(),
  }),
])
export type EmailBlock = z.infer<typeof emailBlockSchema>

/** Locked footer block — rendered with the workspace unsubscribe link. */
export const emailFooterBlockSchema = z.object({ type: z.literal('footer') })
export type EmailFooterBlock = z.infer<typeof emailFooterBlockSchema>

export const templateBlocksSchema = z
  .array(emailBlockSchema)
  .max(25)
  .superRefine((blocks, ctx) => {
    const heroCount = blocks.filter((block) => block.type === 'hero').length
    if (heroCount > 1) {
      ctx.addIssue({ code: 'custom', message: 'At most one hero block is allowed' })
    }
  })
export type TemplateBlocks = z.infer<typeof templateBlocksSchema>

/**
 * The full editor document: editable blocks + the locked unsubscribe footer.
 * Stored as one jsonb array so rendering and versioning stay trivial.
 */
export const templateDocumentSchema = z
  .object({ blocks: templateBlocksSchema, footer: emailFooterBlockSchema })
  .strict()
export type TemplateDocument = z.infer<typeof templateDocumentSchema>

export const emailTemplates = pgTable(
  'email_templates',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    name: varchar('name', { length: 200 }).notNull(),
    kind: templateKindPgEnum().notNull().default('custom'),
    /** Current draft document (autosave); published copies live in versions. */
    draftDocument: jsonb('draft_document').$type<TemplateDocument>(),
    draftSubject: varchar('draft_subject', { length: 150 }),
    draftPreheader: varchar('draft_preheader', { length: 300 }),
    currentVersion: integer('current_version').notNull().default(0),
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
    uniqueIndex('idx_email_templates_public').on(table.publicId),
    index('idx_email_templates_kind').on(table.kind),
    index('idx_email_templates_updated').on(table.updatedAt),
  ],
)

export const emailTemplateVersions = pgTable(
  'email_template_versions',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    templateId: bigint('template_id', { mode: 'number' })
      .notNull()
      .references(() => emailTemplates.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    version: integer('version').notNull(),
    subject: varchar('subject', { length: 150 }).notNull(),
    preheader: varchar('preheader', { length: 300 }),
    document: jsonb('document').$type<TemplateDocument>().notNull(),
    publishedBy: text('published_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_email_template_versions_public').on(table.publicId),
    uniqueIndex('idx_email_template_versions_unique').on(table.templateId, table.version),
    index('idx_email_template_versions_template').on(table.templateId, table.version),
    check('version_positive_check', sql`${table.version} > 0`),
  ],
)

export const emailTemplatesRelations = relations(emailTemplates, ({ one, many }) => ({
  author: one(users, {
    fields: [emailTemplates.createdBy],
    references: [users.id],
  }),
  versions: many(emailTemplateVersions),
}))

export const emailTemplateVersionsRelations = relations(emailTemplateVersions, ({ one }) => ({
  template: one(emailTemplates, {
    fields: [emailTemplateVersions.templateId],
    references: [emailTemplates.id],
  }),
  publisher: one(users, {
    fields: [emailTemplateVersions.publishedBy],
    references: [users.id],
  }),
}))

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates, {
  name: z.string().trim().min(1).max(200),
  kind: templateKindEnum.default('custom'),
  draftSubject: z.string().max(150).nullable().optional(),
  draftPreheader: z.string().max(300).nullable().optional(),
  draftDocument: templateDocumentSchema.nullable().optional(),
  currentVersion: z.number().int().min(0).default(0),
}).omit({ publicId: true })
export const selectEmailTemplateSchema = createSelectSchema(emailTemplates)
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>
export type SelectEmailTemplate = z.infer<typeof selectEmailTemplateSchema>

export const insertEmailTemplateVersionSchema = createInsertSchema(emailTemplateVersions, {
  version: z.number().int().min(1),
  subject: z.string().min(1).max(150),
  preheader: z.string().max(300).nullable().optional(),
  document: templateDocumentSchema,
}).omit({ publicId: true })
export const selectEmailTemplateVersionSchema = createSelectSchema(emailTemplateVersions)
export type InsertEmailTemplateVersion = z.infer<typeof insertEmailTemplateVersionSchema>
export type SelectEmailTemplateVersion = z.infer<typeof selectEmailTemplateVersionSchema>
