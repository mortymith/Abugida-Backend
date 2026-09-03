/**
 * @module exam-types.schemas
 *
 * Zod schemas for the exam types feature module.
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

// ── ExamType schemas ───────────────────────────────────────────────────────

export const ExamTypeSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      slug: z.string(),
      description: z.string().nullable(),
      parentExamTypeId: z.string().uuid().nullable(),
      depth: z.number().int(),
      sortOrder: z.number().int(),
      isActive: z.boolean(),
      children: z.array(ExamTypeSchema).optional(),
    })
    .openapi('ExamType'),
)

// ── GET /exam-types ────────────────────────────────────────────────────────

export const ListExamTypesQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque cursor for pagination'),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional().describe('Page size'),
  include_children: z.coerce
    .boolean()
    .default(false)
    .optional()
    .describe('Include immediate children nested under each exam type'),
})

export const ListExamTypesResponseSchema = cursorPaginatedResponseSchema(ExamTypeSchema)

// ── GET /exam-types/{examTypeId} ───────────────────────────────────────────

export const GetExamTypeParamsSchema = z.object({
  examTypeId: z.string().uuid(),
})

export const GetExamTypeQuerySchema = z.object({
  include_children: z.coerce.boolean().default(true).optional(),
})

export const GetExamTypeResponseSchema = singleResponseSchema(ExamTypeSchema)

// ── GET /exam-types/{examTypeId}/children ──────────────────────────────────

export const ListChildExamTypesParamsSchema = z.object({
  examTypeId: z.string().uuid(),
})

export const ListChildExamTypesResponseSchema = collectionResponseSchema(ExamTypeSchema)
