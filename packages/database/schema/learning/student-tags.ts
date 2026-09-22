import {
  bigint,
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'

/**
 * Free-form student tags (spec 06 S-4.8 `tag_added` trigger; e.g. corporate
 * cohorts "acme-2026"). Managed from the student profile.
 */
export const studentTags = pgTable(
  'student_tags',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tag: varchar('tag', { length: 60 }).notNull(),
    addedBy: text('added_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_student_tags_public').on(table.publicId),
    uniqueIndex('idx_student_tags_unique').on(table.studentId, table.tag),
    index('idx_student_tags_tag').on(table.tag),
  ],
)

export const studentTagsRelations = relations(studentTags, ({ one }) => ({
  student: one(users, {
    fields: [studentTags.studentId],
    references: [users.id],
  }),
}))

export const insertStudentTagSchema = createInsertSchema(studentTags, {
  tag: z.string().trim().min(1).max(60),
}).omit({ publicId: true, createdAt: true })
export const selectStudentTagSchema = createSelectSchema(studentTags)
export type InsertStudentTag = z.infer<typeof insertStudentTagSchema>
export type SelectStudentTag = z.infer<typeof selectStudentTagSchema>
