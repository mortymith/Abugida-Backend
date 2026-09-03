/**
 * @module exam-types.routes
 *
 * OpenAPI route definitions for the exam types feature module.
 */

import { createRoute } from '@hono/zod-openapi'
import {
  NotFoundSchema,
  TooManyRequestsSchema,
  ListExamTypesQuerySchema,
  ListExamTypesResponseSchema,
  GetExamTypeParamsSchema,
  GetExamTypeQuerySchema,
  GetExamTypeResponseSchema,
  ListChildExamTypesParamsSchema,
  ListChildExamTypesResponseSchema,
} from './exam-types.schemas'

// ── GET /exam-types ────────────────────────────────────────────────────────

export const listExamTypesRoute = createRoute({
  method: 'get',
  path: '/exam-types',
  tags: ['ExamTypes'],
  summary: 'List top-level exam types',
  description: 'Public endpoint. Returns all top-level exam types with cursor-based pagination.',
  operationId: 'listExamTypes',
  request: {
    query: ListExamTypesQuerySchema,
  },
  responses: {
    200: {
      description: 'Exam types retrieved',
      headers: {
        'Cache-Control': {
          schema: { type: 'string', example: 'public, max-age=3600' },
        },
      },
      content: { 'application/json': { schema: ListExamTypesResponseSchema } },
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

export type ListExamTypesRoute = typeof listExamTypesRoute

// ── GET /exam-types/{examTypeId} ───────────────────────────────────────────

export const getExamTypeRoute = createRoute({
  method: 'get',
  path: '/exam-types/{examTypeId}',
  tags: ['ExamTypes'],
  summary: 'Get exam type details with children',
  description: 'Returns a single exam type including its child exam types.',
  operationId: 'getExamType',
  request: {
    params: GetExamTypeParamsSchema,
    query: GetExamTypeQuerySchema,
  },
  responses: {
    200: {
      description: 'Exam type retrieved',
      content: { 'application/json': { schema: GetExamTypeResponseSchema } },
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

export type GetExamTypeRoute = typeof getExamTypeRoute

// ── GET /exam-types/{examTypeId}/children ──────────────────────────────────

export const listChildExamTypesRoute = createRoute({
  method: 'get',
  path: '/exam-types/{examTypeId}/children',
  tags: ['ExamTypes'],
  summary: 'List child exam types',
  description: 'Returns all child exam types for the given parent exam type.',
  operationId: 'listChildExamTypes',
  request: {
    params: ListChildExamTypesParamsSchema,
  },
  responses: {
    200: {
      description: 'Child exam types retrieved',
      content: { 'application/json': { schema: ListChildExamTypesResponseSchema } },
    },
    404: {
      description: 'Parent exam type not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type ListChildExamTypesRoute = typeof listChildExamTypesRoute
