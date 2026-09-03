/**
 * @module bundles.routes
 *
 * OpenAPI route definitions for the bundles feature module.
 */

import { createRoute } from '@hono/zod-openapi'
import {
  NotFoundSchema,
  GoneSchema,
  TooManyRequestsSchema,
  ListBundlesQuerySchema,
  ListBundlesResponseSchema,
  GetBundleParamsSchema,
  GetBundleResponseSchema,
  ListBundleCoursesParamsSchema,
  ListBundleCoursesResponseSchema,
  GetBundlePurchaseOptionsParamsSchema,
  GetBundlePurchaseOptionsResponseSchema,
  ListBundlesByExamTypeParamsSchema,
  ListBundlesByExamTypeQuerySchema,
  ListBundlesByExamTypeResponseSchema,
  SearchBundlesQuerySchema,
  SearchBundlesResponseSchema,
} from './bundles.schemas'

// ── GET /bundles ───────────────────────────────────────────────────────────

export const listBundlesRoute = createRoute({
  method: 'get',
  path: '/bundles',
  tags: ['Bundles'],
  summary: 'List published course bundles',
  description: 'Returns all published course bundles with cursor-based pagination and sorting.',
  operationId: 'listBundles',
  request: {
    query: ListBundlesQuerySchema,
  },
  responses: {
    200: {
      description: 'Bundles retrieved',
      content: { 'application/json': { schema: ListBundlesResponseSchema } },
    },
    400: {
      description: 'Invalid query parameters',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type ListBundlesRoute = typeof listBundlesRoute

// ── GET /bundles/{bundleId} ────────────────────────────────────────────────

export const getBundleRoute = createRoute({
  method: 'get',
  path: '/bundles/{bundleId}',
  tags: ['Bundles'],
  summary: 'Get bundle details',
  description: 'Returns full bundle details including pricing, discount, and course count.',
  operationId: 'getBundle',
  request: {
    params: GetBundleParamsSchema,
  },
  responses: {
    200: {
      description: 'Bundle retrieved',
      content: { 'application/json': { schema: GetBundleResponseSchema } },
    },
    404: {
      description: 'Bundle not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    410: {
      description: 'Bundle is no longer available',
      content: { 'application/problem+json': { schema: GoneSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type GetBundleRoute = typeof getBundleRoute

// ── GET /bundles/{bundleId}/courses ────────────────────────────────────────

export const listBundleCoursesRoute = createRoute({
  method: 'get',
  path: '/bundles/{bundleId}/courses',
  tags: ['Bundles'],
  summary: 'List courses in a bundle',
  description:
    'Returns all courses included in the bundle. Only returns courses where is_included = true.',
  operationId: 'listBundleCourses',
  request: {
    params: ListBundleCoursesParamsSchema,
  },
  responses: {
    200: {
      description: 'Bundle courses retrieved',
      content: { 'application/json': { schema: ListBundleCoursesResponseSchema } },
    },
    404: {
      description: 'Bundle not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type ListBundleCoursesRoute = typeof listBundleCoursesRoute

// ── GET /bundles/{bundleId}/purchase-options ────────────────────────────────

export const getBundlePurchaseOptionsRoute = createRoute({
  method: 'get',
  path: '/bundles/{bundleId}/purchase-options',
  tags: ['Bundles'],
  summary: 'Get purchase options for a bundle',
  description: 'Returns Telebirr purchase options for this bundle.',
  operationId: 'getBundlePurchaseOptions',
  request: {
    params: GetBundlePurchaseOptionsParamsSchema,
  },
  responses: {
    200: {
      description: 'Purchase options retrieved',
      headers: {
        'X-Platform-Payment-Methods': {
          description: 'Available payment methods',
          schema: {
            type: 'array',
            items: { type: 'string', enum: ['telebirr'] },
          },
        },
      },
      content: { 'application/json': { schema: GetBundlePurchaseOptionsResponseSchema } },
    },
    404: {
      description: 'Bundle not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type GetBundlePurchaseOptionsRoute = typeof getBundlePurchaseOptionsRoute

// ── GET /exam-types/{examTypeId}/bundles ───────────────────────────────────

export const listBundlesByExamTypeRoute = createRoute({
  method: 'get',
  path: '/exam-types/{examTypeId}/bundles',
  tags: ['Bundles'],
  summary: 'List bundles for an exam type',
  description: 'Returns published bundles themed around the given exam type.',
  operationId: 'listBundlesByExamType',
  request: {
    params: ListBundlesByExamTypeParamsSchema,
    query: ListBundlesByExamTypeQuerySchema,
  },
  responses: {
    200: {
      description: 'Bundles retrieved',
      content: { 'application/json': { schema: ListBundlesByExamTypeResponseSchema } },
    },
    404: {
      description: 'Exam type not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type ListBundlesByExamTypeRoute = typeof listBundlesByExamTypeRoute

// ── GET /search/bundles ────────────────────────────────────────────────────

export const searchBundlesRoute = createRoute({
  method: 'get',
  path: '/search/bundles',
  tags: ['Bundles'],
  summary: 'Search for bundles',
  description: 'Search bundles by keyword, exam type, or price range.',
  operationId: 'searchBundles',
  request: {
    query: SearchBundlesQuerySchema,
  },
  responses: {
    200: {
      description: 'Bundle search results retrieved',
      content: { 'application/json': { schema: SearchBundlesResponseSchema } },
    },
    400: {
      description: 'Invalid query parameters',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type SearchBundlesRoute = typeof searchBundlesRoute
