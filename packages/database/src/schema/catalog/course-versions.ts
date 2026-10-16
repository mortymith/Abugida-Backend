import {
  pgTable,
  bigint,
  uuid,
  integer,
  text,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { courses } from '../catalog/courses'
import { users } from '../auth/users'

/**
 * Versioned snapshot of a course, written by `publishCourse` and
 * `restoreVersionAsDraft` (spec 04 S-2.22 → _Version History_ slide-over).
 *
 * Storage model (decision D2): **full snapshot** rather than deltas. A row
 * captures `bodySnapshot` (course meta + modules + lessons at the moment of
 * publish), `readinessSnapshot` (the RC-1…RC-8 evaluation result that
 * justified the publish), and `itemDeltas` (a computed summary
 * `+N -M ~K` for the slide-over row).
 *
 * `restoreVersionAsDraft` always writes `v(n+1)` (never deletes prior
 * versions) — the audit trail must stay complete. Versions are retained
 * per the project retention policy (50 most-recent per course).
 *
 * `version` is 1-indexed and increments on every publish; the first publish
 * of a course writes v1.
 */
export const courseVersions = pgTable(
  'course_versions',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    version: integer('version').notNull(),
    actorId: text('actor_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    /**
     * Full snapshot of the course's published state: meta + modules + lessons.
     * Stored as jsonb so the slide-over can render a diff without joining
     * multiple tables. Approximate size per version: 50–100 KB.
     */
    bodySnapshot: jsonb('body_snapshot').notNull(),
    /**
     * Result of `getPublishReadiness` at the moment of publish. Used by the
     * slide-over to show "what passed when this version shipped".
     */
    readinessSnapshot: jsonb('readiness_snapshot').notNull(),
    /**
     * Computed summary of what changed vs the previous version:
     * `{ added: number, removed: number, modified: number, items: Array<{id,title,kind,change}> }`.
     * Lets the slide-over render `+2 -0 ~1` without recomputing a diff.
     */
    itemDeltas: jsonb('item_deltas')
      .notNull()
      .default({ added: 0, removed: 0, modified: 0, items: [] }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_course_versions_public').on(table.publicId),
    uniqueIndex('idx_course_versions_course_version').on(table.courseId, table.version),
    index('idx_course_versions_course').on(table.courseId, table.version),
    index('idx_course_versions_actor').on(table.actorId),
  ],
)

export const courseVersionsRelations = relations(courseVersions, ({ one }) => ({
  course: one(courses, {
    fields: [courseVersions.courseId],
    references: [courses.id],
  }),
  actor: one(users, {
    fields: [courseVersions.actorId],
    references: [users.id],
    relationName: 'course_version_actor',
  }),
}))

export const insertCourseVersionSchema = createInsertSchema(courseVersions, {
  courseId: z.number().positive(),
  version: z.number().int().min(1),
  actorId: z.string().min(1),
  bodySnapshot: z.record(z.string(), z.unknown()),
  readinessSnapshot: z.record(z.string(), z.unknown()),
  itemDeltas: z
    .record(z.string(), z.unknown())
    .default({ added: 0, removed: 0, modified: 0, items: [] }),
}).omit({
  publicId: true,
})
export const selectCourseVersionSchema = createSelectSchema(courseVersions)
export const updateCourseVersionSchema = insertCourseVersionSchema.partial()
export type InsertCourseVersion = z.infer<typeof insertCourseVersionSchema>
export type SelectCourseVersion = z.infer<typeof selectCourseVersionSchema>
export type UpdateCourseVersion = z.infer<typeof updateCourseVersionSchema>
