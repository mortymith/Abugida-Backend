/**
 * @module tags.schemas
 *
 * Zod schemas for the tags feature module.
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

// ── Tag schemas ────────────────────────────────────────────────────────────

export const TagSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
  })
  .openapi('Tag')

// ── Course summary schema (for courses by tag) ─────────────────────────────

export const CourseSummarySchema = z
  .object({
    courseId: z.string().uuid(),
    title: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    thumbnailUrl: z.string().nullable(),
    isFree: z.boolean(),
    status: z.enum(['draft', 'published', 'archived']),
  })
  .openapi('CourseSummary')

// ── GET /tags ──────────────────────────────────────────────────────────────

export const ListTagsResponseSchema = collectionResponseSchema(TagSchema)

// ── GET /tags/{tagId}/courses ──────────────────────────────────────────────

export const ListCoursesByTagParamsSchema = z.object({
  tagId: z.string().uuid(),
})

export const ListCoursesByTagQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque cursor for pagination'),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional().describe('Page size'),
})

export const ListCoursesByTagResponseSchema = cursorPaginatedResponseSchema(CourseSummarySchema)
