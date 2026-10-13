import { z } from 'zod'

/** S-2.2 Course details form. Draft save applies partial validation (title only). */
export const courseDetailsSchema = z.object({
  title: z.string().trim().min(3).max(100),
  description: z
    .string()
    .trim()
    .min(100)
    .max(500)
    .or(z.literal(''))
    .transform((value) => value || ''),
  examTypeId: z.number().int().positive(),
  instructorId: z.string().trim().min(1),
  courseType: z.enum(['self_paced', 'instructor_led', 'hybrid']).default('self_paced'),
  level: z.enum(['beginner', 'intermediate', 'advanced']).nullable().default(null),
  thumbnailObjectKey: z.string().trim().max(500).nullable().default(null),
})

/** Strict variant used by "Next" (full validation); draft save only needs a title. */
export const courseDetailsDraftSchema = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().max(500).optional(),
  examTypeId: z.number().int().positive().optional(),
  instructorId: z.string().trim().optional(),
  courseType: z.enum(['self_paced', 'instructor_led', 'hybrid']).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).nullable().optional(),
  thumbnailObjectKey: z.string().trim().max(500).nullable().optional(),
})

export type CourseDetailsInput = z.input<typeof courseDetailsSchema>
export type CourseDetails = z.output<typeof courseDetailsSchema>

/** S-2.3 curriculum tree save — full replacement of module/lesson ordering. */
export const curriculumLessonNodeSchema = z.object({
  publicId: z.string().uuid(),
  title: z.string().trim().min(3).max(300),
})

export const curriculumModuleNodeSchema = z.object({
  publicId: z.string().uuid(),
  title: z.string().trim().min(3).max(300),
  lessons: z.array(curriculumLessonNodeSchema),
})

export const curriculumSaveSchema = z.object({
  coursePublicId: z.string().uuid(),
  modules: z.array(curriculumModuleNodeSchema).min(1),
})

export type CurriculumSaveInput = z.infer<typeof curriculumSaveSchema>

/** S-2.4 pricing model. Subscription periods map to purchase_options.durationDays. */
export const billingPeriodSchema = z.enum(['monthly', 'quarterly', 'annual'])
export type BillingPeriod = z.infer<typeof billingPeriodSchema>

export const discountInputSchema = z.object({
  percentage: z.number().min(1).max(99),
  /** Early-bird deadline. */
  endsAt: z.string().datetime().nullable().default(null),
  /** Bulk threshold. */
  minEnrollments: z.number().int().positive().nullable().default(null),
})

export const coursePricingSchema = z
  .object({
    model: z.enum(['free', 'one_time', 'subscription']),
    priceAmount: z.number().min(0).nullable().default(null),
    priceCurrency: z.string().length(3).default('ETB'),
    billingPeriod: billingPeriodSchema.optional(),
    enrollmentStartAt: z.string().datetime().nullable().default(null),
    enrollmentEndAt: z.string().datetime().nullable().default(null),
    earlyBird: discountInputSchema.nullable().default(null),
    bulk: discountInputSchema.nullable().default(null),
    /** Payment-gateway publicIds the course is sold through. */
    gatewayPublicIds: z.array(z.string().uuid()).min(1),
  })
  .superRefine((value, ctx) => {
    if (value.model !== 'free') {
      if (value.priceAmount == null || value.priceAmount <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['priceAmount'],
          message: 'Price must be greater than 0',
        })
      }
    }
    if (
      value.enrollmentStartAt &&
      value.enrollmentEndAt &&
      value.enrollmentEndAt <= value.enrollmentStartAt
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['enrollmentEndAt'],
        message: 'End date must be after the start date',
      })
    }
    if (value.earlyBird && !value.earlyBird.endsAt) {
      ctx.addIssue({ code: 'custom', path: ['earlyBird', 'endsAt'], message: 'Deadline required' })
    }
    if (value.bulk && !value.bulk.minEnrollments) {
      ctx.addIssue({
        code: 'custom',
        path: ['bulk', 'minEnrollments'],
        message: 'Minimum enrollments required',
      })
    }
  })

export type CoursePricingInput = z.infer<typeof coursePricingSchema>

/** S-2.5 publish step. */
export const coursePublishSchema = z
  .object({
    coursePublicId: z.string().uuid(),
    visibility: z.enum(['draft', 'published']),
    releaseMode: z.enum(['immediate', 'scheduled']).default('immediate'),
    scheduledFor: z.string().datetime().nullable().default(null),
    notifyStudents: z.boolean().default(true),
    notifySubscribers: z.boolean().default(true),
    /** Spec: publish stays disabled until this is checked. */
    confirmed: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.visibility === 'published') {
      if (!value.confirmed) {
        ctx.addIssue({
          code: 'custom',
          path: ['confirmed'],
          message: 'Please confirm all content is complete',
        })
      }
      if (value.releaseMode === 'scheduled' && !value.scheduledFor) {
        ctx.addIssue({
          code: 'custom',
          path: ['scheduledFor'],
          message: 'Pick a release date and time',
        })
      }
    }
  })

export type CoursePublishInput = z.infer<typeof coursePublishSchema>

/**
 * S-2.17 `setItemVisibility`: the per-item `draft ⇄ published ⇄ scheduled`
 * toggle. This changes one item and never the course — an item can be published
 * inside a draft course, and unpublishing one drops it from the published set
 * immediately without touching the rest of the curriculum.
 *
 * `scheduledPublishAt` is required exactly when the target is `scheduled`; the
 * server rejects the mismatch rather than silently storing a null.
 */
export const setItemVisibilitySchema = z
  .object({
    coursePublicId: z.string().uuid(),
    lessonPublicId: z.string().uuid(),
    visibility: z.enum(['draft', 'published', 'scheduled']),
    scheduledPublishAt: z.string().datetime().nullable().default(null),
  })
  .superRefine((value, ctx) => {
    if (value.visibility === 'scheduled' && value.scheduledPublishAt === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['scheduledPublishAt'],
        message: 'Pick when this item should publish',
      })
    }
  })

export type SetItemVisibilityInput = z.infer<typeof setItemVisibilitySchema>

/** S-2.22 course-level review submission (a note is optional). */
export const courseReviewSubmitSchema = z.object({
  coursePublicId: z.string().uuid(),
  submissionNote: z.string().trim().max(2000).nullable().default(null),
})

/** S-2.22 reviewer decision. A comment is required to *not* approve. */
export const courseReviewDecisionSchema = z
  .object({
    coursePublicId: z.string().uuid(),
    decision: z.enum(['approve', 'request_changes', 'reject']),
    comment: z.string().trim().max(2000).default(''),
  })
  .superRefine((value, ctx) => {
    if (value.decision !== 'approve' && value.comment.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['comment'],
        message: 'Explain what should change — the author sees this',
      })
    }
  })
