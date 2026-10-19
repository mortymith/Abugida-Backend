/**
 * Lesson body revision history — spec 12 § 14.1.
 *
 * Spec 12 § 14 deferred revision history entirely, which breaks the reviewer's
 * job: S-2.14 asks a reviewer to judge a change, and with no prior version
 * there is nothing to change *from*. This is the minimum that satisfies
 * DESIGN.md § 5.10 — without building Git.
 *
 * Storage: one append-only table. Retention is 30 revisions per lesson with a
 * documented prune job; the row count is bounded regardless of how often the
 * buffer flushes. The table is never read by the render path — it exists for
 * the review panel and the Restore action.
 *
 * When a revision is written — and when it is not:
 *
 *  - Explicit `Flush now` (Ctrl/⌘+S) → `save`
 *  - Submit for review → `save` (the reviewer needs a baseline at the moment
 *    of the decision)
 *  - AI Accept (§ 11.1) → `ai_accept`
 *  - Restore a previous version → `restore` (appends; never deletes)
 *  - § 5.3 migration → `migration` (keeps the pre-migration HTML comparable)
 *  - 60s autosave timer → NO revision (would make history unreadable and
 *    unbounded; the autosave path is covered by the IndexedDB mirror instead)
 *  - Context switch / unmount flush → NO revision (a transport event, not a
 *    declared save point)
 */
import { bigint, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { lessons } from './lessons'
import { lessonBodyFormatPgEnum, lessonBodyFormatEnum } from './lessons'

/**
 * The reason a revision was written. Each value is a discrete save-point kind
 * the reviewer can identify at a glance:
 *
 *  - `save` — an explicit Flush now or a submit-for-review.
 *  - `ai_accept` — the author accepted AI-generated body text (§ 11.1).
 *  - `restore` — the author restored a previous version. Appends; never
 *     deletes or truncates history.
 *  - `migration` — the § 5.3 HTML → Markdown migration. Keeps the
 *     pre-migration HTML comparable to the Markdown.
 */
export const lessonBodyRevisionReasonEnum = z.enum(['save', 'ai_accept', 'restore', 'migration'])
export type LessonBodyRevisionReason = z.infer<typeof lessonBodyRevisionReasonEnum>
export const lessonBodyRevisionReasonPgEnum = pgEnum('lesson_body_revision_reason', [
  'save',
  'ai_accept',
  'restore',
  'migration',
])

/**
 * Append-only revision history. There is no `updatedAt` and no `deletedAt` —
 * the table is write-once. The prune job is a separate background task that
 * keeps the 30 most recent revisions per lesson.
 *
 * `bodyFormat` is denormalized here so a pre-migration HTML revision can be
 * compared to a post-migration Markdown revision without a format lookup.
 *
 * No indexes are declared here: Drizzle's index API uses `.on()` for column
 * indexes, and the reviewer panel's "newest-first per lesson" query orders by
 * `(lessonId, createdAt DESC)` in its own ORDER BY clause.
 */
export const lessonBodyRevisions = pgTable('lessons_body_revisions', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  publicId: uuid('public_id').notNull().defaultRandom().unique(),
  lessonId: bigint('lesson_id', { mode: 'number' })
    .notNull()
    .references(() => lessons.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  bodyFormat: lessonBodyFormatPgEnum('body_format').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  reason: lessonBodyRevisionReasonPgEnum().notNull(),
})

export const lessonBodyRevisionsRelations = relations(lessonBodyRevisions, ({ one }) => ({
  lesson: one(lessons, {
    fields: [lessonBodyRevisions.lessonId],
    references: [lessons.id],
  }),
}))

export const insertLessonBodyRevisionSchema = createInsertSchema(lessonBodyRevisions, {
  body: z.string().max(200_000),
  bodyFormat: lessonBodyFormatEnum,
  reason: lessonBodyRevisionReasonEnum,
}).omit({
  publicId: true,
  createdAt: true,
})

export const selectLessonBodyRevisionSchema = createSelectSchema(lessonBodyRevisions)

export type InsertLessonBodyRevision = z.infer<typeof insertLessonBodyRevisionSchema>
export type SelectLessonBodyRevision = z.infer<typeof selectLessonBodyRevisionSchema>

/**
 * The retention bound. The prune job keeps the N most recent revisions per
 * lesson; older rows are deleted. 30 is enough for a reviewer to see a
 * meaningful history without the table growing unbounded on a heavily-edited
 * lesson.
 */
export const LESSON_BODY_REVISION_RETENTION = 30
