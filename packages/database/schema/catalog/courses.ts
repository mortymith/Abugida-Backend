import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  numeric,
  char,
  boolean,
  timestamp,
  integer,
  smallint,
  uniqueIndex,
  index,
  check,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { examTypes } from './exam-types'
import { users } from '../auth/users'
import { courseStats } from './course-stats'
import { courseStatsHistory } from './course-stats-history'
import { modules } from './modules'
import { lessons } from './lessons'
import { enrollments } from '../learning/enrollments'
import { courseReviews } from '../learning/course-reviews'
import { courseTagAssignments } from './course-tag-assignments'
import { bundleCourses } from './bundle-courses'
import { purchaseOptions } from '../finance/purchase-options'
import { purchases } from '../finance/purchases'
import { auditLogs } from '../ops/audit-logs'
export const courseStatusEnum = z.enum(['draft', 'published', 'archived'])
export type CourseStatus = z.infer<typeof courseStatusEnum>
export const courseStatusPgEnum = pgEnum('course_status', ['draft', 'published', 'archived'])
export const courses = pgTable(
  'courses',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    examTypeId: bigint('exam_type_id', { mode: 'number' })
      .notNull()
      .references(() => examTypes.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    instructorId: bigint('instructor_id', { mode: 'number' }).references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    title: varchar('title', { length: 300 }).notNull(),
    slug: varchar('slug', { length: 200 }).notNull().unique(),
    description: text('description'),
    thumbnailObjectKey: varchar('thumbnail_object_key', { length: 500 }),
    priceAmount: numeric('price_amount', { precision: 19, scale: 4 }),
    priceCurrency: char('price_currency', { length: 3 }).notNull().default('ETB'),
    isFree: boolean('is_free').notNull().default(false),
    status: courseStatusPgEnum().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    rowVersion: integer('row_version').notNull().default(1),
    sortOrder: smallint('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_courses_public').on(table.publicId),
    index('idx_courses_list_query').on(table.examTypeId, table.status, table.sortOrder),
    uniqueIndex('idx_courses_slug').on(table.slug),
    index('idx_courses_instructor').on(table.instructorId),
    index('idx_courses_discovery').on(table.status, table.isFree),
    index('idx_courses_active_list')
      .on(table.examTypeId, table.status, table.sortOrder)
      .where(sql`${table.deletedAt} IS NULL`),

    check('price_check', sql`${table.priceAmount} >= 0 OR ${table.priceAmount} IS NULL`),
    check('currency_check', sql`${table.priceCurrency} ~ '^[A-Z]{3}$'`),
    check('version_check', sql`${table.version} >= 1`),
    check('sort_order_check', sql`${table.sortOrder} >= 0`),
  ],
)
export const coursesRelations = relations(courses, ({ one, many }) => ({
  examType: one(examTypes, {
    fields: [courses.examTypeId],
    references: [examTypes.id],
  }),
  instructor: one(users, {
    fields: [courses.instructorId],
    references: [users.id],
    relationName: 'instructor_courses',
  }),
  stats: one(courseStats, {
    fields: [courses.id],
    references: [courseStats.courseId],
  }),
  statsHistory: many(courseStatsHistory),
  modules: many(modules),
  lessons: many(lessons),
  enrollments: many(enrollments, {
    relationName: 'course_enrollments',
  }),
  reviews: many(courseReviews),
  tags: many(courseTagAssignments),
  bundles: many(bundleCourses),
  purchaseOptions: many(purchaseOptions, {
    relationName: 'course_purchase_options',
  }),
  purchases: many(purchases, {
    relationName: 'course_purchases',
  }),
  auditLogs: many(auditLogs, {
    relationName: 'course_audit_logs',
  }),
}))
export const insertCourseSchema = createInsertSchema(courses, {
  title: z.string().min(1).max(300),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().nullable().optional(),
  examTypeId: z.number().positive(),
  instructorId: z.number().positive().nullable().optional(),
  thumbnailObjectKey: z.string().max(500).nullable().optional(),
  priceAmount: z.number().min(0).nullable().optional(),
  priceCurrency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/)
    .default('ETB'),
  isFree: z.boolean().default(false),
  status: courseStatusEnum.default('draft'),
  publishedAt: z.date().nullable().optional(),
  version: z.number().int().min(1).default(1),
  rowVersion: z.number().int().min(1).default(1),
  sortOrder: z.number().int().min(0).default(0),
}).omit({
  publicId: true,
})
export const selectCourseSchema = createSelectSchema(courses)
export const updateCourseSchema = insertCourseSchema.partial()
export type InsertCourse = z.infer<typeof insertCourseSchema>
export type SelectCourse = z.infer<typeof selectCourseSchema>
export type UpdateCourse = z.infer<typeof updateCourseSchema>
