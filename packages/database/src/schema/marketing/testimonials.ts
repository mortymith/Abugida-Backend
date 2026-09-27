import {
  pgTable,
  bigint,
  uuid,
  varchar,
  text,
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
import { users } from '../auth/users'
import { courses } from '../catalog/courses'

/**
 * Student testimonials (spec 10 S-8.5): consent-first collection requests
 * and a moderation queue feeding published quotes to course landing pages.
 * Consent must be verified before a submission can be approved; rejected
 * submissions are archived for reference. Anonymized students' testimonials
 * are excluded from published reads (privacy, S-6.10).
 */

export const testimonialStatusEnum = z.enum(['pending', 'published', 'rejected', 'archived'])
export type TestimonialStatus = z.infer<typeof testimonialStatusEnum>
export const testimonialStatusPgEnum = pgEnum('testimonial_status', [
  'pending',
  'published',
  'rejected',
  'archived',
])

export const testimonialTriggerEnum = z.enum(['completion', 'five_star_rating', 'manual'])
export type TestimonialTrigger = z.infer<typeof testimonialTriggerEnum>
export const testimonialTriggerPgEnum = pgEnum('testimonial_trigger', [
  'completion',
  'five_star_rating',
  'manual',
])

export const testimonials = pgTable(
  'testimonials',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    quote: varchar('quote', { length: 400 }).notNull(),
    rating: smallint('rating'),
    /** Verified consent to display publicly — mandatory before approval. */
    consentConfirmed: boolean('consent_confirmed').notNull().default(false),
    status: testimonialStatusPgEnum().notNull().default('pending'),
    featured: boolean('featured').notNull().default(false),
    featuredAt: timestamp('featured_at', { withTimezone: true }),
    /** Light edits are allowed; heavier edits flag student re-confirmation. */
    editedBy: text('edited_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    editNote: varchar('edit_note', { length: 200 }),
    heavyEdit: boolean('heavy_edit').notNull().default(false),
    rejectionReason: text('rejection_reason'),
    /** Request that spawned this submission (manual collects are null). */
    requestId: bigint('request_id', { mode: 'number' }),
    trigger: testimonialTriggerPgEnum().notNull().default('manual'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_testimonials_public').on(table.publicId),
    index('idx_testimonials_status').on(table.status, table.createdAt),
    index('idx_testimonials_course').on(table.courseId, table.featured),
    index('idx_testimonials_student').on(table.studentId),
    check(
      'testimonial_quote_check',
      sql`LENGTH(${table.quote}) >= 20 AND LENGTH(${table.quote}) <= 400`,
    ),
    check(
      'testimonial_rating_check',
      sql`${table.rating} IS NULL OR (${table.rating} >= 1 AND ${table.rating} <= 5)`,
    ),
    check(
      'testimonial_consent_check',
      sql`${table.status} <> 'published' OR ${table.consentConfirmed}`,
    ),
  ],
)

export const testimonialRequestStatusEnum = z.enum(['open', 'submitted', 'dismissed'])
export type TestimonialRequestStatus = z.infer<typeof testimonialRequestStatusEnum>
export const testimonialRequestStatusPgEnum = pgEnum('testimonial_request_status', [
  'open',
  'submitted',
  'dismissed',
])

/** Auto or manual collection requests (spec: automated collection triggers). */
export const testimonialRequests = pgTable(
  'testimonial_requests',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    courseId: bigint('course_id', { mode: 'number' })
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    trigger: testimonialTriggerPgEnum().notNull(),
    status: testimonialRequestStatusPgEnum().notNull().default('open'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_testimonial_requests_public').on(table.publicId),
    index('idx_testimonial_requests_status').on(table.status, table.requestedAt),
    index('idx_testimonial_requests_student_course').on(table.studentId, table.courseId),
  ],
)

export const testimonialsRelations = relations(testimonials, ({ one }) => ({
  student: one(users, {
    fields: [testimonials.studentId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [testimonials.courseId],
    references: [courses.id],
  }),
}))

export const testimonialRequestsRelations = relations(testimonialRequests, ({ one }) => ({
  student: one(users, {
    fields: [testimonialRequests.studentId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [testimonialRequests.courseId],
    references: [courses.id],
  }),
}))

export const insertTestimonialSchema = createInsertSchema(testimonials, {
  quote: z.string().trim().min(20).max(400),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  consentConfirmed: z.boolean().default(false),
  status: testimonialStatusEnum.default('pending'),
  trigger: testimonialTriggerEnum.default('manual'),
}).omit({ publicId: true })
export const selectTestimonialSchema = createSelectSchema(testimonials)
export type InsertTestimonial = z.infer<typeof insertTestimonialSchema>
export type SelectTestimonial = z.infer<typeof selectTestimonialSchema>
