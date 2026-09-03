/**
 * @module purchases.routes
 *
 * OpenAPI route definitions for the purchases feature module.
 */

import { createRoute } from '@hono/zod-openapi'
import {
  NotFoundSchema,
  ConflictSchema,
  TooManyRequestsSchema,
  GetCoursePurchaseOptionsParamsSchema,
  GetCoursePurchaseOptionsResponseSchema,
  ListPurchasesQuerySchema,
  ListPurchasesResponseSchema,
  PurchaseInitiateRequestSchema,
  InitiatePurchaseResponseSchema,
  GetPurchaseParamsSchema,
  GetPurchaseResponseSchema,
} from './purchases.schemas'

// ── GET /courses/{courseId}/purchase-options ────────────────────────────────

export const getCoursePurchaseOptionsRoute = createRoute({
  method: 'get',
  path: '/courses/{courseId}/purchase-options',
  tags: ['Purchases'],
  summary: 'Get purchase options for a course',
  description:
    'Returns purchase options for a specific course. Telebirr is the sole payment method.',
  operationId: 'getCoursePurchaseOptions',
  request: {
    params: GetCoursePurchaseOptionsParamsSchema,
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
      content: { 'application/json': { schema: GetCoursePurchaseOptionsResponseSchema } },
    },
    404: {
      description: 'Course not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type GetCoursePurchaseOptionsRoute = typeof getCoursePurchaseOptionsRoute

// ── GET /purchases ─────────────────────────────────────────────────────────

export const listPurchasesRoute = createRoute({
  method: 'get',
  path: '/purchases',
  tags: ['Purchases'],
  summary: 'List user purchases',
  description: 'Returns all purchases (courses and bundles) for the authenticated user.',
  operationId: 'listPurchases',
  request: {
    query: ListPurchasesQuerySchema,
  },
  responses: {
    200: {
      description: 'Purchases retrieved',
      content: { 'application/json': { schema: ListPurchasesResponseSchema } },
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

export type ListPurchasesRoute = typeof listPurchasesRoute

// ── POST /purchases ────────────────────────────────────────────────────────

export const initiatePurchaseRoute = createRoute({
  method: 'post',
  path: '/purchases',
  tags: ['Purchases'],
  summary: 'Initiate a purchase',
  description: 'Initiates a purchase for either a course OR a bundle (XOR constraint).',
  operationId: 'initiatePurchase',
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: PurchaseInitiateRequestSchema } },
    },
  },
  responses: {
    201: {
      description: 'Purchase initiated',
      content: { 'application/json': { schema: InitiatePurchaseResponseSchema } },
    },
    400: {
      description: 'Invalid purchase request',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    409: {
      description: 'Purchase already in progress',
      content: { 'application/problem+json': { schema: ConflictSchema } },
    },
    422: {
      description: 'Validation error',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type InitiatePurchaseRoute = typeof initiatePurchaseRoute

// ── GET /purchases/{purchaseId} ────────────────────────────────────────────

export const getPurchaseRoute = createRoute({
  method: 'get',
  path: '/purchases/{purchaseId}',
  tags: ['Purchases'],
  summary: 'Get purchase details',
  description: 'Returns full purchase details including status, amount, and generated enrollments.',
  operationId: 'getPurchase',
  request: {
    params: GetPurchaseParamsSchema,
  },
  responses: {
    200: {
      description: 'Purchase details retrieved',
      content: { 'application/json': { schema: GetPurchaseResponseSchema } },
    },
    404: {
      description: 'Purchase not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type GetPurchaseRoute = typeof getPurchaseRoute
