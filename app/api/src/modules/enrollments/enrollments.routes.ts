/**
 * @module enrollments.routes
 *
 * OpenAPI route definitions for the enrollments feature module. Covers
 * progress stats, enrollment list/detail, lesson completions, and
 * lesson completion toggle.
 */

import { createRoute, z } from '@hono/zod-openapi'
import {
  UnauthorizedSchema,
  NotFoundSchema,
  ConflictSchema,
  ValidationErrorSchema,
  TooManyRequestsSchema,
  GetProgressResponseSchema,
  EnrollmentListQuerySchema,
  ListEnrollmentsResponseSchema,
  GetEnrollmentResponseSchema,
  LessonCompletionListQuerySchema,
  ListLessonCompletionsResponseSchema,
  LessonCompletionUpdateSchema,
  UpdateLessonCompletionResponseSchema,
} from './enrollments.schemas'

// ── GET /users/me/progress ─────────────────────────────────────────────────

export const getProgressRoute = createRoute({
  method: 'get',
  path: '/users/me/progress',
  tags: ['Progress'],
  summary: 'Get user learning progress',
  description:
    'Returns aggregated learning progress computed from enrollments and lesson completions.',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'Progress statistics.',
      content: { 'application/json': { schema: GetProgressResponseSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type GetProgressRoute = typeof getProgressRoute

// ── GET /users/me/enrollments ──────────────────────────────────────────────

export const listEnrollmentsRoute = createRoute({
  method: 'get',
  path: '/users/me/enrollments',
  tags: ['Progress'],
  summary: 'List user enrollments',
  description: 'Returns all course enrollments for the authenticated user with cursor pagination.',
  security: [{ Bearer: [] }],
  request: {
    query: EnrollmentListQuerySchema,
  },
  responses: {
    200: {
      description: 'Paginated enrollment list.',
      content: { 'application/json': { schema: ListEnrollmentsResponseSchema } },
    },
    400: {
      description: 'Invalid query parameters.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type ListEnrollmentsRoute = typeof listEnrollmentsRoute

// ── GET /users/me/enrollments/{enrollmentId} ───────────────────────────────

export const getEnrollmentRoute = createRoute({
  method: 'get',
  path: '/users/me/enrollments/{enrollmentId}',
  tags: ['Progress'],
  summary: 'Get enrollment details',
  description:
    'Returns detailed enrollment information including bundle source and lesson progress.',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      enrollmentId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Enrollment details.',
      content: { 'application/json': { schema: GetEnrollmentResponseSchema } },
    },
    400: {
      description: 'Invalid enrollment ID.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    404: {
      description: 'Enrollment not found.',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type GetEnrollmentRoute = typeof getEnrollmentRoute

// ── GET /users/me/enrollments/{enrollmentId}/lesson-completions ────────────

export const listLessonCompletionsRoute = createRoute({
  method: 'get',
  path: '/users/me/enrollments/{enrollmentId}/lesson-completions',
  tags: ['Progress'],
  summary: 'List lesson completions for an enrollment',
  description: 'Returns all lesson completion records for the given enrollment.',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      enrollmentId: z.string().uuid(),
    }),
    query: LessonCompletionListQuerySchema,
  },
  responses: {
    200: {
      description: 'Paginated lesson completion list.',
      content: { 'application/json': { schema: ListLessonCompletionsResponseSchema } },
    },
    400: {
      description: 'Invalid parameters.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    404: {
      description: 'Enrollment not found.',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type ListLessonCompletionsRoute = typeof listLessonCompletionsRoute

// ── PUT /users/me/enrollments/{enrollmentId}/lesson-completions/{lessonId} ─

export const updateLessonCompletionRoute = createRoute({
  method: 'put',
  path: '/users/me/enrollments/{enrollmentId}/lesson-completions/{lessonId}',
  tags: ['Progress'],
  summary: 'Mark a lesson as complete or incomplete',
  description:
    'Toggles lesson completion status. On completion, triggers recalculation of enrollment progress percentage. Increments row_version for optimistic concurrency.',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      enrollmentId: z.string().uuid(),
      lessonId: z.string().uuid(),
    }),
    body: {
      description: 'Lesson completion update.',
      content: { 'application/json': { schema: LessonCompletionUpdateSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Lesson completion updated.',
      content: { 'application/json': { schema: UpdateLessonCompletionResponseSchema } },
    },
    400: {
      description: 'Invalid request.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    404: {
      description: 'Enrollment or lesson not found.',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    409: {
      description: 'Conflict (e.g. stale row version).',
      content: { 'application/problem+json': { schema: ConflictSchema } },
    },
    422: {
      description: 'Validation error.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type UpdateLessonCompletionRoute = typeof updateLessonCompletionRoute
