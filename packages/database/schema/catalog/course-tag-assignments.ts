import { pgTable, bigint, uuid, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { courses } from './courses'
import { courseTags } from './course-tags'
export const courseTagAssignments = pgTable(
  'course_tag_assignments',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    tagId: bigint('tag_id', { mode: 'number' })
      .notNull()
      .references(() => courseTags.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_course_tag_assignments_public').on(table.publicId),
    uniqueIndex('idx_course_tag_assignments_unique').on(table.courseId, table.tagId),
    index('idx_course_tag_assignments_tag').on(table.tagId),
    index('idx_course_tag_assignments_course').on(table.courseId),
  ],
)
export const courseTagAssignmentsRelations = relations(courseTagAssignments, ({ one }) => ({
  course: one(courses, {
    fields: [courseTagAssignments.courseId],
    references: [courses.id],
  }),
  tag: one(courseTags, {
    fields: [courseTagAssignments.tagId],
    references: [courseTags.id],
  }),
}))
export const insertCourseTagAssignmentSchema = createInsertSchema(courseTagAssignments, {
  courseId: z.number().positive(),
  tagId: z.number().positive(),
}).omit({
  publicId: true,
})
export const selectCourseTagAssignmentSchema = createSelectSchema(courseTagAssignments)
export type InsertCourseTagAssignment = z.infer<typeof insertCourseTagAssignmentSchema>
export type SelectCourseTagAssignment = z.infer<typeof selectCourseTagAssignmentSchema>
