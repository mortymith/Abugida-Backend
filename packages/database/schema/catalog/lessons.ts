import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  integer,
  smallint,
  boolean,
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
import { modules } from './modules'
import { courses } from './courses'
import { users } from '../auth/users'
import { lessonCompletions } from '../learning/lesson-completions'
import { quizQuestions } from '../learning/quiz-questions'
import { quizAttempts } from '../learning/quiz-attempts'
import { contentLicenses } from '../finance/content-licenses'
import { auditLogs } from '../ops/audit-logs'
import { tsvector } from '../shared/custom-types'
export const contentTypeEnum = z.enum(['pdf', 'video', 'quiz', 'exercise', 'link'])
export type ContentType = z.infer<typeof contentTypeEnum>
export const contentTypePgEnum = pgEnum('content_type', [
  'pdf',
  'video',
  'quiz',
  'exercise',
  'link',
])
export const lessons = pgTable(
  'lessons',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    moduleId: bigint('module_id', { mode: 'number' })
      .notNull()
      .references(() => modules.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    instructorId: bigint('instructor_id', { mode: 'number' }).references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    title: varchar('title', { length: 300 }).notNull(),
    description: text('description'),
    contentType: contentTypePgEnum(),
    fileObjectKey: varchar('file_object_key', { length: 500 }),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    mimeType: varchar('mime_type', { length: 100 }),
    durationSeconds: integer('duration_seconds'),
    pageCount: smallint('page_count'),
    isDownloadable: boolean('is_downloadable').notNull().default(true),
    downloadSizeLimitBytes: bigint('download_size_limit_bytes', {
      mode: 'number',
    })
      .notNull()
      .default(524288000),
    searchVector: tsvector('search_vector'),
    rowVersion: integer('row_version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_lessons_public').on(table.publicId),
    index('idx_lessons_module').on(table.moduleId),
    index('idx_lessons_course').on(table.courseId),
    index('idx_lessons_content_type').on(table.contentType),
    index('idx_lessons_instructor').on(table.instructorId),
    index('idx_lessons_search').using('gin', table.searchVector),
    index('idx_lessons_course_type').on(table.courseId, table.contentType),
    index('idx_lessons_module_active')
      .on(table.moduleId)
      .where(sql`${table.deletedAt} IS NULL`),

    check('file_size_check', sql`${table.fileSizeBytes} >= 0 OR ${table.fileSizeBytes} IS NULL`),
    check('duration_check', sql`${table.durationSeconds} >= 0 OR ${table.durationSeconds} IS NULL`),
    check('page_count_check', sql`${table.pageCount} > 0 OR ${table.pageCount} IS NULL`),
    check('download_limit_check', sql`${table.downloadSizeLimitBytes} >= 0`),
  ],
)
export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  module: one(modules, {
    fields: [lessons.moduleId],
    references: [modules.id],
  }),
  course: one(courses, {
    fields: [lessons.courseId],
    references: [courses.id],
  }),
  instructor: one(users, {
    fields: [lessons.instructorId],
    references: [users.id],
    relationName: 'lesson_instructor',
  }),
  completions: many(lessonCompletions),
  quizQuestions: many(quizQuestions),
  quizAttempts: many(quizAttempts),
  licenses: many(contentLicenses),
  auditLogs: many(auditLogs, {
    relationName: 'lesson_audit_logs',
  }),
}))
export const insertLessonSchema = createInsertSchema(lessons, {
  title: z.string().min(1).max(300),
  description: z.string().nullable().optional(),
  moduleId: z.number().positive(),
  courseId: z.number().positive(),
  instructorId: z.number().positive().nullable().optional(),
  contentType: contentTypeEnum,
  fileObjectKey: z.string().max(500).nullable().optional(),
  fileSizeBytes: z.number().int().min(0).nullable().optional(),
  mimeType: z.string().max(100).nullable().optional(),
  durationSeconds: z.number().int().min(0).nullable().optional(),
  pageCount: z.number().int().positive().nullable().optional(),
  isDownloadable: z.boolean().default(true),
  downloadSizeLimitBytes: z.number().int().min(0).default(524288000),
  rowVersion: z.number().int().min(1).default(1),
}).omit({
  publicId: true,
  searchVector: true,
})
export const selectLessonSchema = createSelectSchema(lessons)
export const updateLessonSchema = insertLessonSchema.partial()
export type InsertLesson = z.infer<typeof insertLessonSchema>
export type SelectLesson = z.infer<typeof selectLessonSchema>
export type UpdateLesson = z.infer<typeof updateLessonSchema>
