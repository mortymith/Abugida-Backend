/**
 * @module purchases.schemas
 *
 * Zod schemas for the purchases feature module.
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

// ── Money schema ───────────────────────────────────────────────────────────

const MoneySchema = z
  .object({
    amount: z.string(),
    currency: z.string(),
  })
  .openapi('Money')

// ── Purchase option schema ─────────────────────────────────────────────────

export const PurchaseOptionSchema = z
  .object({
    id: z.string().uuid(),
    courseId: z.string().uuid().nullable(),
    bundleId: z.string().uuid().nullable(),
    platform: z.enum(['IOS', 'ANDROID', 'WEB']),
    productId: z.string(),
    displayName: z.string(),
    description: z.string().nullable(),
    durationDays: z.number().int().min(1),
    price: MoneySchema,
    isActive: z.boolean(),
  })
  .openapi('PurchaseOption')

// ── Purchase schema ────────────────────────────────────────────────────────

export const PurchaseSchema = z
  .object({
    id: z.string().uuid(),
    courseId: z.string().uuid().nullable(),
    bundleId: z.string().uuid().nullable(),
    purchaseOptionId: z.string().uuid(),
    status: z.enum(['INITIATED', 'PAYMENT_PENDING', 'COMPLETED', 'FAILED']),
    amount: MoneySchema,
    completedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    enrollments: z.array(z.string().uuid()),
  })
  .openapi('Purchase')

// ── GET /courses/{courseId}/purchase-options ────────────────────────────────

export const GetCoursePurchaseOptionsParamsSchema = z.object({
  courseId: z.string().uuid(),
})

export const GetCoursePurchaseOptionsResponseSchema = collectionResponseSchema(PurchaseOptionSchema)

// ── GET /purchases ─────────────────────────────────────────────────────────

export const ListPurchasesQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque cursor for pagination'),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional().describe('Page size'),
  type: z.enum(['COURSE', 'BUNDLE']).optional().describe('Filter by purchase type'),
})

export const ListPurchasesResponseSchema = cursorPaginatedResponseSchema(PurchaseSchema)

// ── POST /purchases ────────────────────────────────────────────────────────

export const PurchaseInitiateRequestSchema = z
  .object({
    courseId: z
      .string()
      .uuid()
      .optional()
      .describe('Course to purchase (mutually exclusive with bundleId)'),
    bundleId: z
      .string()
      .uuid()
      .optional()
      .describe('Bundle to purchase (mutually exclusive with courseId)'),
    purchaseOptionId: z.string().uuid().describe('Selected purchase option'),
    platform: z.enum(['IOS', 'ANDROID', 'WEB']).describe("User's current platform"),
  })
  .refine((data) => (data.courseId ? !data.bundleId : data.bundleId), {
    message: 'Exactly one of courseId or bundleId must be provided',
  })
  .openapi('PurchaseInitiateRequest')

export const InitiatePurchaseResponseSchema = singleResponseSchema(PurchaseSchema)

// ── GET /purchases/{purchaseId} ────────────────────────────────────────────

export const GetPurchaseParamsSchema = z.object({
  purchaseId: z.string().uuid(),
})

export const GetPurchaseResponseSchema = singleResponseSchema(PurchaseSchema)
