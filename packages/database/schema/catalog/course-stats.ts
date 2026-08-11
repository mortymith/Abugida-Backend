import { pgTable, bigint, integer, numeric, timestamp, index, check } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { courses } from './courses'
export const courseStats = pgTable(
  'course_stats',
  {
    courseId: bigint('course_id', { mode: 'number' })
      .primaryKey()
      .references(() => courses.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    totalEnrollments: integer('total_enrollments').notNull().default(0),
    activeStudents7d: integer('active_students_7d').notNull().default(0),
    downloads30d: integer('downloads_30d').notNull().default(0),
    purchaseCount: integer('purchase_count').notNull().default(0),
    averageRating: numeric('average_rating', { precision: 3, scale: 2 }),
    ratingCount: integer('rating_count').notNull().default(0),
    weightedRating: numeric('weighted_rating', { precision: 4, scale: 3 }),
    popularityScore: numeric('popularity_score', { precision: 10, scale: 4 }),
    calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_course_stats_recommendation').on(table.popularityScore, table.weightedRating),

    check('enrollments_check', sql`${table.totalEnrollments} >= 0`),
    check('active_check', sql`${table.activeStudents7d} >= 0`),
    check('downloads_check', sql`${table.downloads30d} >= 0`),
    check('purchases_check', sql`${table.purchaseCount} >= 0`),
    check(
      'rating_check',
      sql`${table.averageRating} >= 1 AND ${table.averageRating} <= 5 OR ${table.averageRating} IS NULL`,
    ),
    check('rating_count_check', sql`${table.ratingCount} >= 0`),
  ],
)
export const courseStatsRelations = relations(courseStats, ({ one }) => ({
  course: one(courses, {
    fields: [courseStats.courseId],
    references: [courses.id],
  }),
}))
export const insertCourseStatsSchema = createInsertSchema(courseStats, {
  totalEnrollments: z.number().int().min(0).default(0),
  activeStudents7d: z.number().int().min(0).default(0),
  downloads30d: z.number().int().min(0).default(0),
  purchaseCount: z.number().int().min(0).default(0),
  averageRating: z.number().min(1).max(5).nullable().optional(),
  ratingCount: z.number().int().min(0).default(0),
  weightedRating: z.number().nullable().optional(),
  popularityScore: z.number().nullable().optional(),
}).omit({
  calculatedAt: true,
})
export const selectCourseStatsSchema = createSelectSchema(courseStats)
export const updateCourseStatsSchema = insertCourseStatsSchema.partial()
export type InsertCourseStats = z.infer<typeof insertCourseStatsSchema>
export type SelectCourseStats = z.infer<typeof selectCourseStatsSchema>
export type UpdateCourseStats = z.infer<typeof updateCourseStatsSchema>
