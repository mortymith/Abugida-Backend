/**
 * @module bookmarks.schemas
 *
 * Zod schemas for the bookmarks feature module.
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

// ── GET /users/me/bookmarks ────────────────────────────────────────────────

export const BookmarkSchema = z
  .object({
    id: z.string().uuid(),
    itemType: z.enum(['course', 'resource']),
    itemId: z.string().uuid(),
    createdAt: z.string().datetime(),
  })
  .openapi('Bookmark')

export const BookmarkListQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque cursor for pagination'),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional().describe('Page size'),
})

export const ListBookmarksResponseSchema = cursorPaginatedResponseSchema(BookmarkSchema)

// ── POST /users/me/bookmarks ───────────────────────────────────────────────

export const BookmarkCreateBodySchema = z
  .object({
    itemType: z.enum(['course', 'resource']),
    itemId: z.string().uuid(),
  })
  .strict()
  .openapi('BookmarkCreate')

export const CreateBookmarkResponseSchema = singleResponseSchema(BookmarkSchema)
