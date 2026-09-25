import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { courses } from './courses'

/**
 * Certificate template per course (spec 04 S-2.10). Field visibility is a
 * boolean map; the signature image is uploaded via @abugida/storage and
 * referenced by object key. Issued certificates are recorded by the student
 * product (S-4.3 reads them).
 */
export const certificateTemplates = pgTable(
  'certificate_templates',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .unique()
      .references(() => courses.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    title: varchar('title', { length: 200 }).notNull(),
    showStudentName: boolean('show_student_name').notNull().default(true),
    showCourseTitle: boolean('show_course_title').notNull().default(true),
    showCompletionDate: boolean('show_completion_date').notNull().default(true),
    showSignature: boolean('show_signature').notNull().default(true),
    signatureObjectKey: varchar('signature_object_key', { length: 500 }),
    signatureLabel: varchar('signature_label', { length: 150 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_certificate_templates_public').on(table.publicId),
    index('idx_certificate_templates_course').on(table.courseId),
  ],
)
export const certificateTemplatesRelations = relations(certificateTemplates, ({ one }) => ({
  course: one(courses, {
    fields: [certificateTemplates.courseId],
    references: [courses.id],
  }),
}))
export const insertCertificateTemplateSchema = createInsertSchema(certificateTemplates, {
  courseId: z.number().positive(),
  title: z.string().min(1).max(200),
  signatureObjectKey: z.string().max(500).nullable().optional(),
  signatureLabel: z.string().max(150).nullable().optional(),
  notes: z.string().nullable().optional(),
}).omit({
  publicId: true,
})
export const selectCertificateTemplateSchema = createSelectSchema(certificateTemplates)
export const updateCertificateTemplateSchema = insertCertificateTemplateSchema.partial()
export type InsertCertificateTemplate = z.infer<typeof insertCertificateTemplateSchema>
export type SelectCertificateTemplate = z.infer<typeof selectCertificateTemplateSchema>
export type UpdateCertificateTemplate = z.infer<typeof updateCertificateTemplateSchema>
