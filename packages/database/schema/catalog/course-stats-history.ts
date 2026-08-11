import {
  pgTable,
  bigint,
  integer,
  numeric,
  timestamp,
  date,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { courses } from './courses'
export const courseStatsHistory = pgTable(
  'course_stats_history',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    snapshotDate: date('snapshot_date').notNull(),
    totalEnrollments: integer('total_enrollments').notNull().default(0),
    activeStudents7d: integer('active_students_7d').notNull().default(0),
    downloads30d: integer('downloads_30d').notNull().default(0),
    purchaseCount: integer('purchase_count').notNull().default(0),
    averageRating: numeric('average_rating', { precision: 3, scale: 2 }),
    popularityScore: numeric('popularity_score', { precision: 10, scale: 4 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_stats_history_course_date').on(table.courseId, table.snapshotDate),
    index('idx_stats_history_date').on(table.snapshotDate),
  ],
)
export const courseStatsHistoryRelations = relations(courseStatsHistory, ({ one }) => ({
  course: one(courses, {
    fields: [courseStatsHistory.courseId],
    references: [courses.id],
  }),
}))
export const insertCourseStatsHistorySchema = createInsertSchema(courseStatsHistory, {
  snapshotDate: z.date(),
  totalEnrollments: z.number().int().min(0).default(0),
  activeStudents7d: z.number().int().min(0).default(0),
  downloads30d: z.number().int().min(0).default(0),
  purchaseCount: z.number().int().min(0).default(0),
  averageRating: z.number().min(1).max(5).nullable().optional(),
  popularityScore: z.number().nullable().optional(),
})
export const selectCourseStatsHistorySchema = createSelectSchema(courseStatsHistory)
export type InsertCourseStatsHistory = z.infer<typeof insertCourseStatsHistorySchema>
export type SelectCourseStatsHistory = z.infer<typeof selectCourseStatsHistorySchema>
