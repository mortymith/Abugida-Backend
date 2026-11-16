/**
 * @module enrollments.schemas
 *
 * Zod schemas for the enrollments feature module. Defines request/response
 * validation contracts for progress, enrollment list, enrollment detail,
 * lesson completions, and lesson completion toggle.
 */

import { z } from '@hono/zod-openapi'

// ── Shared error schemas ───────────────────────────────────────────────────

export const ProblemDetailSchema = z
  .object({
    type: z.string().url(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    instance: z.string(),
    correlationId: z.string().uuid().optional(),
  })
  .openapi('ProblemDetail')

export const UnauthorizedSchema = ProblemDetailSchema.extend({
  status: z.literal(401),
}).openapi('Unauthorized')

export const NotFoundSchema = ProblemDetailSchema.extend({
  status: z.literal(404),
}).openapi('NotFound')

export const ConflictSchema = ProblemDetailSchema.extend({
  status: z.literal(409),
}).openapi('Conflict')

export const ValidationErrorSchema = ProblemDetailSchema.extend({
  status: z.literal(422),
}).openapi('ValidationError')

export const TooManyRequestsSchema = ProblemDetailSchema.extend({
  status: z.literal(429),
}).openapi('TooManyRequests')

// ── Single response wrapper ────────────────────────────────────────────────

export function singleResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z
    .object({
      data: dataSchema,
    })
    .openapi('SingleResponse')
}

// ── Cursor pagination ──────────────────────────────────────────────────────

export function cursorPaginatedResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z
    .object({
      data: z.array(dataSchema),
      meta: z.object({
        cursor: z.string().nullable(),
        hasMore: z.boolean(),
        limit: z.number().int(),
      }),
    })
    .openapi('CursorPaginatedResponse')
}

// ── GET /users/me/progress ─────────────────────────────────────────────────

export const ProgressStatsSchema = z
  .object({
    totalEnrollments: z.number().int(),
    activeEnrollments: z.number().int(),
    completedEnrollments: z.number().int(),
    totalLessonsCompleted: z.number().int().optional(),
    totalStudyTimeSeconds: z.number().int().optional(),
  })
  .openapi('ProgressStats')

export const GetProgressResponseSchema = singleResponseSchema(ProgressStatsSchema)

// ── GET /users/me/enrollments ──────────────────────────────────────────────

export const EnrollmentSchema = z
  .object({
    id: z.string().uuid(),
    courseId: z.string().uuid(),
    purchaseId: z.string().uuid().nullable(),
    bundleId: z.string().uuid().nullable(),
    enrollmentSource: z.enum([
      'purchase',
      'bundle_purchase',
      'free_access',
      'admin_grant',
      'preview',
    ]),
    progressPercentage: z.number().min(0).max(100),
    isCompleted: z.boolean(),
    completedAt: z.string().datetime().nullable(),
    lastAccessedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi('Enrollment')

export const EnrollmentListQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque cursor for pagination'),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional().describe('Page size'),
  status: z
    .enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'])
    .optional()
    .describe('Filter by enrollment status'),
  source: z
    .enum(['PURCHASE', 'BUNDLE_PURCHASE', 'FREE_ACCESS', 'ADMIN_GRANT', 'PREVIEW'])
    .optional()
    .describe('Filter by enrollment source'),
})

export const ListEnrollmentsResponseSchema = cursorPaginatedResponseSchema(EnrollmentSchema)

// ── GET /users/me/enrollments/{enrollmentId} ───────────────────────────────

export const EnrollmentDetailSchema = EnrollmentSchema.extend({
  totalLessons: z.number().int(),
  completedLessons: z.number().int(),
  rowVersion: z.number().int(),
}).openapi('EnrollmentDetail')

export const GetEnrollmentResponseSchema = singleResponseSchema(EnrollmentDetailSchema)

// ── GET /users/me/enrollments/{enrollmentId}/lesson-completions ────────────

export const LessonCompletionSchema = z
  .object({
    id: z.string().uuid(),
    lessonId: z.string().uuid(),
    enrollmentId: z.string().uuid(),
    isCompleted: z.boolean(),
    completedAt: z.string().datetime().nullable(),
    timeSpentSeconds: z.number().int().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('LessonCompletion')

export const LessonCompletionListQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque cursor for pagination'),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional().describe('Page size'),
})

export const ListLessonCompletionsResponseSchema =
  cursorPaginatedResponseSchema(LessonCompletionSchema)

// ── PUT /users/me/enrollments/{enrollmentId}/lesson-completions/{lessonId} ─

export const LessonCompletionUpdateSchema = z
  .object({
    isCompleted: z.boolean(),
    timeSpentSeconds: z.number().int().min(0).optional(),
  })
  .strict()
  .openapi('LessonCompletionUpdate')

export const UpdateLessonCompletionResponseSchema = singleResponseSchema(LessonCompletionSchema)
