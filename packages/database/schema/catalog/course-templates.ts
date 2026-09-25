import {
  pgTable,
  bigint,
  uuid,
  varchar,
  smallint,
  text,
  jsonb,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

/**
 * Reusable course template (spec 04 S-2.12). The full curriculum skeleton is
 * stored as JSON so "Use template" can instantiate real courses/modules/
 * lessons in one transaction; imported rows are tagged `source: template`.
 */
export const courseTemplates = pgTable(
  'course_templates',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 200 }).notNull().unique(),
    description: text('description'),
    category: varchar('category', { length: 100 }).notNull().default('general'),
    structure: jsonb('structure').notNull(),
    moduleCount: smallint('module_count').notNull().default(0),
    lessonCount: smallint('lesson_count').notNull().default(0),
    quizCount: smallint('quiz_count').notNull().default(0),
    isFeatured: boolean('is_featured').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_course_templates_public').on(table.publicId),
    uniqueIndex('idx_course_templates_slug').on(table.slug),
    index('idx_course_templates_category').on(table.category, table.isActive),
  ],
)
export const courseTemplatesRelations = relations(courseTemplates, () => ({}))
export const insertCourseTemplateSchema = createInsertSchema(courseTemplates, {
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().nullable().optional(),
  category: z.string().min(1).max(100).default('general'),
  structure: z.unknown(),
  moduleCount: z.number().int().min(0).default(0),
  lessonCount: z.number().int().min(0).default(0),
  quizCount: z.number().int().min(0).default(0),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
}).omit({
  publicId: true,
})
export const selectCourseTemplateSchema = createSelectSchema(courseTemplates)
export const updateCourseTemplateSchema = insertCourseTemplateSchema.partial()
export type InsertCourseTemplate = z.infer<typeof insertCourseTemplateSchema>
export type SelectCourseTemplate = z.infer<typeof selectCourseTemplateSchema>
export type UpdateCourseTemplate = z.infer<typeof updateCourseTemplateSchema>
