import {
  pgTable,
  bigint,
  uuid,
  smallint,
  boolean,
  timestamp,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { courseBundles } from './course-bundles'
import { courses } from './courses'
export const bundleCourses = pgTable(
  'bundle_courses',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    bundleId: bigint('bundle_id', { mode: 'number' })
      .notNull()
      .references(() => courseBundles.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    sortOrder: smallint('sort_order').notNull().default(0),
    isIncluded: boolean('is_included').notNull().default(true),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_bundle_courses_public').on(table.publicId),
    uniqueIndex('idx_bundle_courses_unique').on(table.bundleId, table.courseId),
    index('idx_bundle_courses_active').on(table.bundleId, table.isIncluded, table.sortOrder),
    index('idx_bundle_courses_course').on(table.courseId),

    check('sort_order_check', sql`${table.sortOrder} >= 0`),
  ],
)
export const bundleCoursesRelations = relations(bundleCourses, ({ one }) => ({
  bundle: one(courseBundles, {
    fields: [bundleCourses.bundleId],
    references: [courseBundles.id],
  }),
  course: one(courses, {
    fields: [bundleCourses.courseId],
    references: [courses.id],
  }),
}))
export const insertBundleCourseSchema = createInsertSchema(bundleCourses, {
  bundleId: z.number().positive(),
  courseId: z.number().positive(),
  sortOrder: z.number().int().min(0).default(0),
  isIncluded: z.boolean().default(true),
}).omit({
  publicId: true,
})
export const selectBundleCourseSchema = createSelectSchema(bundleCourses)
export const updateBundleCourseSchema = insertBundleCourseSchema.partial()
export type InsertBundleCourse = z.infer<typeof insertBundleCourseSchema>
export type SelectBundleCourse = z.infer<typeof selectBundleCourseSchema>
export type UpdateBundleCourse = z.infer<typeof updateBundleCourseSchema>
