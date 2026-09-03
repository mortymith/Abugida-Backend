/**
 * @module quizzes.routes
 *
 * OpenAPI route definitions for the quizzes feature module.
 */

import { createRoute } from '@hono/zod-openapi'
import {
  NotFoundSchema,
  UnprocessableEntitySchema,
  TooManyRequestsSchema,
  GetQuizParamsSchema,
  GetQuizResponseSchema,
  SubmitQuizParamsSchema,
  QuizSubmitRequestBodySchema,
  SubmitQuizResponseSchema,
  ListQuizAttemptsParamsSchema,
  ListQuizAttemptsQuerySchema,
  ListQuizAttemptsResponseSchema,
  GetQuizAttemptParamsSchema,
  GetQuizAttemptResponseSchema,
} from './quizzes.schemas'

// ── GET /resources/{resourceId}/quiz ───────────────────────────────────────

export const getQuizQuestionsRoute = createRoute({
  method: 'get',
  path: '/resources/{resourceId}/quiz',
  tags: ['Quiz'],
  summary: 'Get quiz questions for a lesson',
  description:
    'Returns all quiz questions for a lesson with content_type=quiz. Does NOT include correct answers. Only accessible to enrolled students.',
  operationId: 'getQuizQuestions',
  security: [{ bearerAuth: [] }],
  request: {
    params: GetQuizParamsSchema,
  },
  responses: {
    200: {
      description: 'Quiz questions retrieved',
      content: { 'application/json': { schema: GetQuizResponseSchema } },
    },
    404: {
      description: 'Lesson not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    422: {
      description: 'Lesson is not a quiz type',
      content: { 'application/problem+json': { schema: UnprocessableEntitySchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type GetQuizQuestionsRoute = typeof getQuizQuestionsRoute

// ── POST /resources/{resourceId}/quiz/submit ───────────────────────────────

export const submitQuizRoute = createRoute({
  method: 'post',
  path: '/resources/{resourceId}/quiz/submit',
  tags: ['Quiz'],
  summary: 'Submit quiz answers',
  description:
    'Submits answers for a quiz attempt. Creates records in quiz_attempts and quiz_answers. Grading is server-side.',
  operationId: 'submitQuizAttempt',
  security: [{ bearerAuth: [] }],
  request: {
    params: SubmitQuizParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: QuizSubmitRequestBodySchema } },
    },
  },
  responses: {
    201: {
      description: 'Quiz attempt recorded with results',
      content: { 'application/json': { schema: SubmitQuizResponseSchema } },
    },
    404: {
      description: 'Lesson not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    422: {
      description: 'Lesson is not a quiz type',
      content: { 'application/problem+json': { schema: UnprocessableEntitySchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type SubmitQuizRoute = typeof submitQuizRoute

// ── GET /resources/{resourceId}/quiz/attempts ──────────────────────────────

export const listQuizAttemptsRoute = createRoute({
  method: 'get',
  path: '/resources/{resourceId}/quiz/attempts',
  tags: ['Quiz'],
  summary: 'List quiz attempts for a lesson',
  description: 'Returns all quiz attempts by the current user for a specific lesson.',
  operationId: 'listQuizAttempts',
  security: [{ bearerAuth: [] }],
  request: {
    params: ListQuizAttemptsParamsSchema,
    query: ListQuizAttemptsQuerySchema,
  },
  responses: {
    200: {
      description: 'Quiz attempts retrieved',
      content: { 'application/json': { schema: ListQuizAttemptsResponseSchema } },
    },
    404: {
      description: 'Lesson not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    422: {
      description: 'Lesson is not a quiz type',
      content: { 'application/problem+json': { schema: UnprocessableEntitySchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type ListQuizAttemptsRoute = typeof listQuizAttemptsRoute

// ── GET /quiz/attempts/{attemptId} ─────────────────────────────────────────

export const getQuizAttemptRoute = createRoute({
  method: 'get',
  path: '/quiz/attempts/{attemptId}',
  tags: ['Quiz'],
  summary: 'Get quiz attempt details with answers',
  description: 'Returns a specific quiz attempt with all answers and explanations.',
  operationId: 'getQuizAttempt',
  security: [{ bearerAuth: [] }],
  request: {
    params: GetQuizAttemptParamsSchema,
  },
  responses: {
    200: {
      description: 'Quiz attempt retrieved',
      content: { 'application/json': { schema: GetQuizAttemptResponseSchema } },
    },
    404: {
      description: 'Quiz attempt not found',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type GetQuizAttemptRoute = typeof getQuizAttemptRoute
