/**
 * @module resources.schemas
 *
 * Zod schemas for the resources feature module.
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

export const NotFoundSchema = ProblemDetailSchema.extend({
  status: z.literal(404),
}).openapi('NotFound')

export const GoneSchema = ProblemDetailSchema.extend({
  status: z.literal(410),
}).openapi('Gone')

export const TooManyRequestsSchema = ProblemDetailSchema.extend({
  status: z.literal(429),
}).openapi('TooManyRequests')

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

export function collectionResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z
    .object({
      data: z.array(dataSchema),
    })
    .openapi('CollectionResponse')
}

export function singleResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z
    .object({
      data: dataSchema,
    })
    .openapi('SingleResponse')
}

// ── Course schemas ─────────────────────────────────────────────────────────

export const CourseSummarySchema = z
  .object({
    courseId: z.string().uuid(),
    title: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    thumbnailUrl: z.string().nullable(),
    priceAmount: z.string().nullable(),
    priceCurrency: z.string(),
    isFree: z.boolean(),
    status: z.string().nullable(),
    publishedAt: z.string().nullable(),
    averageRating: z.string().nullable(),
    ratingCount: z.number().int(),
    totalEnrollments: z.number().int(),
  })
  .openapi('CourseSummary')

export const CourseDetailSchema = z
  .object({
    courseId: z.string().uuid(),
    examTypeId: z.string().uuid(),
    title: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    thumbnailUrl: z.string().nullable(),
    priceAmount: z.string().nullable(),
    priceCurrency: z.string(),
    isFree: z.boolean(),
    status: z.string().nullable(),
    publishedAt: z.string().nullable(),
    version: z.number().int(),
    averageRating: z.string().nullable(),
    ratingCount: z.number().int(),
    totalEnrollments: z.number().int(),
    rowVersion: z.number().int(),
  })
  .openapi('CourseDetail')

// ── Curriculum schemas ─────────────────────────────────────────────────────

export const CurriculumLessonSchema = z
  .object({
    lessonId: z.string().uuid(),
    title: z.string(),
    contentType: z.string().nullable(),
    durationSeconds: z.number().int().nullable(),
    isDownloadable: z.boolean(),
  })
  .openapi('CurriculumLesson')

export const CurriculumModuleSchema = z
  .object({
    moduleId: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    sortOrder: z.number().int(),
    estimatedDurationMinutes: z.number().int().nullable(),
    lessons: z.array(CurriculumLessonSchema),
  })
  .openapi('CurriculumModule')

export const CourseCurriculumSchema = z
  .object({
    courseId: z.string().uuid(),
    title: z.string(),
    modules: z.array(CurriculumModuleSchema),
  })
  .openapi('CourseCurriculum')

// ── Module summary schema ──────────────────────────────────────────────────

export const ModuleSummarySchema = z
  .object({
    moduleId: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    sortOrder: z.number().int(),
    estimatedDurationMinutes: z.number().int().nullable(),
    isPreviewAvailable: z.boolean(),
    lessonCount: z.number().int(),
  })
  .openapi('ModuleSummary')

// ── Lesson summary schema ──────────────────────────────────────────────────

export const LessonSummarySchema = z
  .object({
    lessonId: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    contentType: z.string().nullable(),
    durationSeconds: z.number().int().nullable(),
    pageCount: z.number().int().nullable(),
    isDownloadable: z.boolean(),
  })
  .openapi('LessonSummary')

// ── Resource detail schema ─────────────────────────────────────────────────

export const ResourceDetailSchema = z
  .object({
    lessonId: z.string().uuid(),
    moduleId: z.string().uuid(),
    courseId: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    contentType: z.string().nullable(),
    fileSizeBytes: z.number().int().nullable(),
    mimeType: z.string().nullable(),
    durationSeconds: z.number().int().nullable(),
    pageCount: z.number().int().nullable(),
    isDownloadable: z.boolean(),
    rowVersion: z.number().int(),
  })
  .openapi('ResourceDetail')

// ── GET /exam-types/{examTypeId}/courses ───────────────────────────────────

export const ListCoursesByExamTypeParamsSchema = z.object({
  examTypeId: z.string().uuid(),
})

export const ListCoursesByExamTypeQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque cursor for pagination'),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional().describe('Page size'),
  sort: z
    .enum(['rating', 'popularity', 'newest', 'price_low', 'price_high'])
    .optional()
    .describe('Sort order'),
})

export const ListCoursesByExamTypeResponseSchema =
  cursorPaginatedResponseSchema(CourseSummarySchema)

// ── GET /courses/{courseId} ────────────────────────────────────────────────

export const GetCourseParamsSchema = z.object({
  courseId: z.string().uuid(),
})

export const GetCourseResponseSchema = singleResponseSchema(CourseDetailSchema)

// ── GET /courses/{courseId}/curriculum ─────────────────────────────────────

export const GetCourseCurriculumParamsSchema = z.object({
  courseId: z.string().uuid(),
})

export const GetCourseCurriculumResponseSchema = singleResponseSchema(CourseCurriculumSchema)

// ── GET /courses/{courseId}/modules ────────────────────────────────────────

export const ListModulesParamsSchema = z.object({
  courseId: z.string().uuid(),
})

export const ListModulesResponseSchema = collectionResponseSchema(ModuleSummarySchema)

// ── GET /modules/{moduleId}/lessons ────────────────────────────────────────

export const ListModuleLessonsParamsSchema = z.object({
  moduleId: z.string().uuid(),
})

export const ListModuleLessonsQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque cursor for pagination'),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional().describe('Page size'),
})

export const ListModuleLessonsResponseSchema = cursorPaginatedResponseSchema(LessonSummarySchema)

// ── GET /resources/{resourceId} ────────────────────────────────────────────

export const GetResourceParamsSchema = z.object({
  resourceId: z.string().uuid(),
})

export const GetResourceResponseSchema = singleResponseSchema(ResourceDetailSchema)
