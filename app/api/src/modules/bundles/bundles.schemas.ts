/**
 * @module bundles.schemas
 *
 * Zod schemas for the bundles feature module.
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

// ── Money schema ───────────────────────────────────────────────────────────

const MoneySchema = z
  .object({
    amount: z.string(),
    currency: z.string(),
  })
  .openapi('Money')

// ── Bundle schemas ─────────────────────────────────────────────────────────

export const BundleSchema = z
  .object({
    id: z.string().uuid(),
    examTypeId: z.string().uuid(),
    title: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    thumbnailUrl: z.string().url().nullable(),
    price: MoneySchema,
    originalPrice: MoneySchema,
    discountPercentage: z.number().min(0).max(100),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
    courseCount: z.number().int(),
    publishedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi('CourseBundle')

export const BundleCourseItemSchema = z
  .object({
    courseId: z.string().uuid(),
    title: z.string(),
    slug: z.string(),
    thumbnailUrl: z.string().url().nullable(),
    individualPrice: MoneySchema,
    sortOrder: z.number().int(),
  })
  .openapi('BundleCourseItem')

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

// ── GET /bundles ───────────────────────────────────────────────────────────

export const ListBundlesQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque cursor for pagination'),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional().describe('Page size'),
  sort: z
    .enum(['newest', 'price_low', 'price_high', 'discount'])
    .default('newest')
    .optional()
    .describe('Sort order'),
})

export const ListBundlesResponseSchema = cursorPaginatedResponseSchema(BundleSchema)

// ── GET /bundles/{bundleId} ────────────────────────────────────────────────

export const GetBundleParamsSchema = z.object({
  bundleId: z.string().uuid(),
})

export const GetBundleResponseSchema = singleResponseSchema(BundleSchema)

// ── GET /bundles/{bundleId}/courses ────────────────────────────────────────

export const ListBundleCoursesParamsSchema = z.object({
  bundleId: z.string().uuid(),
})

export const ListBundleCoursesResponseSchema = collectionResponseSchema(BundleCourseItemSchema)

// ── GET /bundles/{bundleId}/purchase-options ────────────────────────────────

export const GetBundlePurchaseOptionsParamsSchema = z.object({
  bundleId: z.string().uuid(),
})

export const GetBundlePurchaseOptionsResponseSchema = collectionResponseSchema(PurchaseOptionSchema)

// ── GET /exam-types/{examTypeId}/bundles ───────────────────────────────────

export const ListBundlesByExamTypeParamsSchema = z.object({
  examTypeId: z.string().uuid(),
})

export const ListBundlesByExamTypeQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque cursor for pagination'),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional().describe('Page size'),
})

export const ListBundlesByExamTypeResponseSchema = cursorPaginatedResponseSchema(BundleSchema)

// ── GET /search/bundles ────────────────────────────────────────────────────

export const SearchBundlesQuerySchema = z.object({
  q: z.string().min(2).max(200).optional().describe('Search query'),
  exam_type: z.string().uuid().optional().describe('Filter by exam type ID'),
  min_price: z.coerce.number().min(0).optional().describe('Minimum price in ETB'),
  max_price: z.coerce.number().min(0).optional().describe('Maximum price in ETB'),
  sort: z
    .enum(['relevance', 'newest', 'price_low', 'price_high', 'discount'])
    .default('relevance')
    .optional()
    .describe('Sort order'),
  cursor: z.string().optional().describe('Opaque cursor for pagination'),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional().describe('Page size'),
})

export const SearchBundlesResponseSchema = cursorPaginatedResponseSchema(BundleSchema)
