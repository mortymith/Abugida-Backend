import { pgTable, bigint, uuid, varchar, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'
import { courseTagAssignments } from './course-tag-assignments'
export const courseTags = pgTable(
  'course_tags',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    description: text('description'),
    createdBy: bigint('created_by', { mode: 'number' }).references(() => users.id, {
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
    uniqueIndex('idx_course_tags_public').on(table.publicId),
    uniqueIndex('idx_course_tags_slug').on(table.slug),
  ],
)
export const courseTagsRelations = relations(courseTags, ({ one, many }) => ({
  creator: one(users, {
    fields: [courseTags.createdBy],
    references: [users.id],
    relationName: 'tag_creator',
  }),
  assignments: many(courseTagAssignments),
}))
export const insertCourseTagSchema = createInsertSchema(courseTags, {
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().nullable().optional(),
  createdBy: z.number().positive().nullable().optional(),
}).omit({
  publicId: true,
})
export const selectCourseTagSchema = createSelectSchema(courseTags)
export const updateCourseTagSchema = insertCourseTagSchema.partial()
export type InsertCourseTag = z.infer<typeof insertCourseTagSchema>
export type SelectCourseTag = z.infer<typeof selectCourseTagSchema>
export type UpdateCourseTag = z.infer<typeof updateCourseTagSchema>
