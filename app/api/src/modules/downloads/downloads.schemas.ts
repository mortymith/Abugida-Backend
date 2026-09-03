/**
 * @module downloads.schemas
 *
 * Zod schemas for the downloads feature module.
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

// ── Path params ────────────────────────────────────────────────────────────

export const CourseIdParamSchema = z.object({
  courseId: z.string().uuid(),
})

// ── Download status ────────────────────────────────────────────────────────

export const DownloadStatusSchema = z
  .object({
    courseId: z.string().uuid(),
    totalSizeBytes: z.number().int().min(0),
    downloadableLessonCount: z.number().int().min(0),
    maxAllowedBytes: z.literal(524288000),
    isWithinLimit: z.boolean(),
  })
  .openapi('DownloadStatus')

export const DownloadStatusResponseSchema = singleResponseSchema(DownloadStatusSchema)

// ── Presigned URL ──────────────────────────────────────────────────────────

export const PresignedDownloadUrlSchema = z
  .object({
    url: z.string().url(),
    expiresIn: z.number().int(),
    expiresAt: z.string().datetime(),
    courseId: z.string().uuid(),
    fileName: z.string(),
    fileSizeBytes: z.number().int().min(0),
  })
  .openapi('PresignedDownloadUrl')

export const PresignedDownloadUrlResponseSchema = singleResponseSchema(PresignedDownloadUrlSchema)

// ── Download initiated ─────────────────────────────────────────────────────

export const DownloadInitiatedSchema = z
  .object({
    courseId: z.string().uuid(),
    status: z.enum(['ready', 'preparing']),
    totalSizeBytes: z.number().int().min(0),
    downloadableLessonCount: z.number().int().min(0),
  })
  .openapi('DownloadInitiated')

export const DownloadInitiatedResponseSchema = singleResponseSchema(DownloadInitiatedSchema)
