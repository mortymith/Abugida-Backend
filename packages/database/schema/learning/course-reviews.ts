import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  smallint,
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
import { courses } from '../catalog/courses'
export const moderationStatusEnum = z.enum(['pending', 'approved', 'rejected', 'edited'])
export type ModerationStatus = z.infer<typeof moderationStatusEnum>
export const moderationStatusPgEnum = pgEnum('moderation_status', [
  'pending',
  'approved',
  'rejected',
  'edited',
])
export const courseReviews = pgTable(
  'course_reviews',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    studentId: bigint('student_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    rating: smallint('rating').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content').notNull(),
    moderationStatus: moderationStatusPgEnum().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_course_reviews_public').on(table.publicId),
    index('idx_course_reviews_course_rating').on(table.courseId, table.rating),
    uniqueIndex('idx_course_reviews_student_course').on(table.studentId, table.courseId),
    index('idx_course_reviews_status_time').on(table.moderationStatus, table.createdAt),

    check('rating_check', sql`${table.rating} >= 1 AND ${table.rating} <= 5`),
  ],
)
export const courseReviewsRelations = relations(courseReviews, ({ one }) => ({
  student: one(users, {
    fields: [courseReviews.studentId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [courseReviews.courseId],
    references: [courses.id],
  }),
}))
export const insertCourseReviewSchema = createInsertSchema(courseReviews, {
  studentId: z.number().positive(),
  courseId: z.number().positive(),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  moderationStatus: moderationStatusEnum.default('pending'),
}).omit({
  publicId: true,
})
export const selectCourseReviewSchema = createSelectSchema(courseReviews)
export const updateCourseReviewSchema = insertCourseReviewSchema.partial()
export type InsertCourseReview = z.infer<typeof insertCourseReviewSchema>
export type SelectCourseReview = z.infer<typeof selectCourseReviewSchema>
export type UpdateCourseReview = z.infer<typeof updateCourseReviewSchema>
