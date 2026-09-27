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
import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'
import { courses } from '../catalog/courses'
import { enrollments } from './enrollments'
import { certificateTemplates } from '../catalog/certificate-templates'

/**
 * Certificates actually issued to students (spec 06 S-4.3 reads them; the
 * per-course templates live in `certificate_templates`, spec 04 S-2.10).
 */
export const issuedCertificates = pgTable(
  'issued_certificates',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    enrollmentId: bigint('enrollment_id', { mode: 'number' }).references(() => enrollments.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    templateId: bigint('template_id', { mode: 'number' }).references(
      () => certificateTemplates.id,
      { onDelete: 'set null', onUpdate: 'cascade' },
    ),
    /** Human-facing certificate serial, e.g. ABG-2026-000123. */
    serial: varchar('serial', { length: 40 }).notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_issued_certificates_public').on(table.publicId),
    uniqueIndex('idx_issued_certificates_serial').on(table.serial),
    // One certificate per student per course.
    uniqueIndex('idx_issued_certificates_unique').on(table.studentId, table.courseId),
    index('idx_issued_certificates_student').on(table.studentId, table.issuedAt),
  ],
)

export const issuedCertificatesRelations = relations(issuedCertificates, ({ one }) => ({
  student: one(users, {
    fields: [issuedCertificates.studentId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [issuedCertificates.courseId],
    references: [courses.id],
  }),
  enrollment: one(enrollments, {
    fields: [issuedCertificates.enrollmentId],
    references: [enrollments.id],
  }),
  template: one(certificateTemplates, {
    fields: [issuedCertificates.templateId],
    references: [certificateTemplates.id],
  }),
}))

export const selectIssuedCertificateSchema = createSelectSchema(issuedCertificates)
export type SelectIssuedCertificate = z.infer<typeof selectIssuedCertificateSchema>
