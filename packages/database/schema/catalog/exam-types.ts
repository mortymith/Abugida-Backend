import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  boolean,
  smallint,
  timestamp,
  uniqueIndex,
  index,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { courses } from './courses'
import { courseBundles } from './course-bundles'
export const examTypes = pgTable(
  'exam_types',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    description: text('description'),
    parentExamTypeId: bigint('parent_exam_type_id', {
      mode: 'number',
    }).references((): AnyPgColumn => examTypes.id, {
      onDelete: 'restrict',
      onUpdate: 'cascade',
    }),
    depth: smallint('depth').notNull().default(0),
    sortOrder: smallint('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_exam_types_public').on(table.publicId),
    uniqueIndex('idx_exam_types_slug').on(table.slug),
    index('idx_exam_types_parent_order').on(table.parentExamTypeId, table.sortOrder),
    index('idx_exam_types_active_order').on(table.isActive, table.sortOrder),

    check('depth_check', sql`${table.depth} >= 0`),
    check('sort_order_check', sql`${table.sortOrder} >= 0`),
  ],
)
export const examTypesRelations = relations(examTypes, ({ one, many }) => ({
  parent: one(examTypes, {
    fields: [examTypes.parentExamTypeId],
    references: [examTypes.id],
  }),
  children: many(examTypes, {
    relationName: 'children',
  }),
  courses: many(courses),
  bundles: many(courseBundles),
}))
export const insertExamTypeSchema = createInsertSchema(examTypes, {
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().nullable().optional(),
  parentExamTypeId: z.number().positive().nullable().optional(),
  depth: z.number().int().min(0).default(0),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
}).omit({
  publicId: true,
})
export const selectExamTypeSchema = createSelectSchema(examTypes)
export const updateExamTypeSchema = insertExamTypeSchema.partial()
export type InsertExamType = z.infer<typeof insertExamTypeSchema>
export type SelectExamType = z.infer<typeof selectExamTypeSchema>
export type UpdateExamType = z.infer<typeof updateExamTypeSchema>
