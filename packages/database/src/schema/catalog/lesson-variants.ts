import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  timestamp,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { lessons } from './lessons'
import { lessonBodyFormatEnum, lessonBodyFormatPgEnum } from './lessons'
import { users } from '../auth/users'

/**
 * Per-language variant of a lesson body (spec 04 S-2.7 → _Translations_
 * sub-tab, spec 11 _Localization & Formatting_).
 *
 * The base variant lives on `lessons` itself (`body`, `body_format`, `title`,
 * `language`); rows in this table are translations into the other supported
 * content languages. The readiness checks (RC-4a/b/c) only evaluate the base
 * variant — an untranslated variant is an *advisory* exemption, never a
 * blocker (spec 04 § Readiness Checks, "Advisory exemptions").
 *
 * `language` is one of `en | am | ti | gez` and is unique per lesson: a lesson
 * cannot have two variants in the same language. The enum is shared with
 * `courses.content_language` so the workspace cannot drift a variant into a
 * language the platform does not recognise.
 */
export const lessonVariantLanguageEnum = z.enum(['en', 'am', 'ti', 'gez'])
export type LessonVariantLanguage = z.infer<typeof lessonVariantLanguageEnum>
export const lessonVariantLanguagePgEnum = pgEnum('lesson_variant_language', [
  'en',
  'am',
  'ti',
  'gez',
])

export const lessonVariants = pgTable(
  'lesson_variants',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    lessonId: bigint('lesson_id', { mode: 'number' })
      .notNull()
      .references(() => lessons.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    language: lessonVariantLanguagePgEnum().notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    body: text('body'),
    bodyFormat: lessonBodyFormatPgEnum('body_format').notNull().default('markdown'),
    updatedBy: text('updated_by').references(() => users.id, {
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
    uniqueIndex('idx_lesson_variants_public').on(table.publicId),
    uniqueIndex('idx_lesson_variants_lesson_lang').on(table.lessonId, table.language),
    index('idx_lesson_variants_lesson').on(table.lessonId),
    index('idx_lesson_variants_language').on(table.language),
  ],
)

export const lessonVariantsRelations = relations(lessonVariants, ({ one }) => ({
  lesson: one(lessons, {
    fields: [lessonVariants.lessonId],
    references: [lessons.id],
  }),
  updater: one(users, {
    fields: [lessonVariants.updatedBy],
    references: [users.id],
    relationName: 'lesson_variant_updater',
  }),
}))

export const insertLessonVariantSchema = createInsertSchema(lessonVariants, {
  lessonId: z.number().positive(),
  language: lessonVariantLanguageEnum,
  title: z.string().min(1).max(300),
  body: z.string().nullable().optional(),
  bodyFormat: lessonBodyFormatEnum.default('markdown'),
  updatedBy: z.string().nullable().optional(),
}).omit({
  publicId: true,
})
export const selectLessonVariantSchema = createSelectSchema(lessonVariants)
export const updateLessonVariantSchema = insertLessonVariantSchema.partial()
export type InsertLessonVariant = z.infer<typeof insertLessonVariantSchema>
export type SelectLessonVariant = z.infer<typeof selectLessonVariantSchema>
export type UpdateLessonVariant = z.infer<typeof updateLessonVariantSchema>
