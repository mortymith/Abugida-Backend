import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  integer,
  smallint,
  boolean,
  jsonb,
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
import { lessonLanguagePgEnum } from './content-language'
import { users } from '../auth/users'
import { lessonCompletions } from '../learning/lesson-completions'
import { quizQuestions } from '../learning/quiz-questions'
import { quizAttempts } from '../learning/quiz-attempts'
import { contentLicenses } from '../finance/content-licenses'
import { auditLogs } from '../ops/audit-logs'
import { assetLibrary } from './asset-library'
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
export const lessonReviewStatusEnum = z.enum([
  'draft',
  'in_review',
  'changes_requested',
  'approved',
])
export type LessonReviewStatus = z.infer<typeof lessonReviewStatusEnum>
export const lessonReviewStatusPgEnum = pgEnum('lesson_review_status', [
  'draft',
  'in_review',
  'changes_requested',
  'approved',
])
/**
 * Serialization format of `lessons.body` (spec 12: Course Editor — Markdown
 * Lesson Authoring). Legacy rows hold HTML produced by `editor.getHTML()`;
 * the Markdown migration flips them to 'markdown'. Defaults to 'html' so that
 * every pre-existing row is correctly described by the new column.
 */
export const lessonBodyFormatEnum = z.enum(['html', 'markdown'])
export type LessonBodyFormat = z.infer<typeof lessonBodyFormatEnum>
export const lessonBodyFormatPgEnum = pgEnum('lesson_body_format', ['html', 'markdown'])
/**
 * Per-item visibility (spec 04 Revision 3, § Item visibility).
 *
 * This is what lets a live course grow one item at a time without republishing
 * the whole thing. It is independent of the course lifecycle, and it is the
 * field the **published set** — the subset `RC-3` / `RC-4` and the completion
 * rule evaluate — is defined by.
 */
export const lessonVisibilityEnum = z.enum(['draft', 'published', 'scheduled'])
export type LessonVisibility = z.infer<typeof lessonVisibilityEnum>
export const lessonVisibilityPgEnum = pgEnum('lesson_visibility', [
  'draft',
  'published',
  'scheduled',
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
    instructorId: text('instructor_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    /** Media provenance (spec 05, "Media"): asset backing this lesson's media. */
    assetId: bigint('asset_id', { mode: 'number' }).references(() => assetLibrary.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    title: varchar('title', { length: 300 }).notNull(),
    description: text('description'),
    contentType: contentTypePgEnum(),
    body: text('body'),
    /**
     * Serialization format of `lessons.body` (spec 12). Legacy rows hold HTML;
     * the Part 12 § 5.3 migration backfilled them to 'markdown'. The DB
     * default is 'markdown' (decision D8) so inserts that omit the column
     * land in the Markdown world the editor writes.
     */
    bodyFormat: lessonBodyFormatPgEnum().notNull().default('markdown'),
    tags: jsonb('tags').notNull().default([]),
    videoUrl: varchar('video_url', { length: 500 }),
    sortOrder: smallint('sort_order').notNull().default(0),
    reviewStatus: lessonReviewStatusPgEnum().default('draft'),
    /**
     * Per-item visibility. Defaults to `'draft'` so a newly authored item is
     * invisible until it is explicitly published — a live course never gains a
     * half-finished item by accident. Migration 0027 backfills lessons of
     * already-published courses to `'published'` so existing live courses do
     * not silently lose their content.
     */
    visibility: lessonVisibilityPgEnum().notNull().default('draft'),
    /** When a `scheduled` item becomes visible; nullable, ignored otherwise. */
    scheduledPublishAt: timestamp('scheduled_publish_at', { withTimezone: true }),
    /**
     * Per-item language override (spec 04 S-2.7 → _Translations_). NULL means
     * "inherit `courses.content_language`". Setting it changes the base
     * variant's language; translation variants live in `lesson_variants`.
     */
    language: lessonLanguagePgEnum(),
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
    /**
     * Set when the lesson is archived. Distinct from `deletedAt`: archive is a
     * reversible hide (spec 04 S-2.17), delete is not.
     */
    archivedAt: timestamp('archived_at', { withTimezone: true }),
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
    index('idx_lessons_review_status').on(table.courseId, table.reviewStatus),
    uniqueIndex('idx_lessons_module_order').on(table.moduleId, table.sortOrder),
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
  body: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  videoUrl: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
  reviewStatus: lessonReviewStatusEnum.default('draft'),
  visibility: lessonVisibilityEnum.default('draft'),
  scheduledPublishAt: z.date().nullable().optional(),
  fileObjectKey: z.string().max(500).nullable().optional(),
  fileSizeBytes: z.number().int().min(0).nullable().optional(),
  mimeType: z.string().max(100).nullable().optional(),
  durationSeconds: z.number().int().min(0).nullable().optional(),
  pageCount: z.number().int().positive().nullable().optional(),
  isDownloadable: z.boolean().default(true),
  archivedAt: z.date().nullable().optional(),
  downloadSizeLimitBytes: z.number().int().min(0).default(524288000),
  rowVersion: z.number().int().min(1).default(1),
}).omit({
  publicId: true,
  searchVector: true,
  bodyFormat: true,
})
export const selectLessonSchema = createSelectSchema(lessons)
export const updateLessonSchema = insertLessonSchema.partial()
export type InsertLesson = z.infer<typeof insertLessonSchema>
export type SelectLesson = z.infer<typeof selectLessonSchema>
export type UpdateLesson = z.infer<typeof updateLessonSchema>
