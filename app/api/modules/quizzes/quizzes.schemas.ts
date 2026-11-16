/**
 * @module quizzes.schemas
 *
 * Zod schemas for the quizzes feature module.
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

export const UnprocessableEntitySchema = ProblemDetailSchema.extend({
  status: z.literal(422),
}).openapi('UnprocessableEntity')

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

export function singleResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z
    .object({
      data: dataSchema,
    })
    .openapi('SingleResponse')
}

// ── Quiz entity schemas ────────────────────────────────────────────────────

export const QuizQuestionSchema = z
  .object({
    id: z.string().uuid(),
    questionIndex: z.number().int().min(0),
    questionText: z.string(),
  })
  .openapi('QuizQuestion')

export const QuizQuestionSetSchema = z
  .object({
    lessonId: z.string().uuid(),
    totalQuestions: z.number().int(),
    questions: z.array(QuizQuestionSchema),
  })
  .openapi('QuizQuestionSet')

export const QuizAnswerResultSchema = z.object({
  questionId: z.string().uuid(),
  isCorrect: z.boolean(),
  explanation: z.string().nullable(),
})

export const QuizAttemptResultSchema = z
  .object({
    attemptId: z.string().uuid(),
    attemptNumber: z.number().int().min(1),
    totalQuestions: z.number().int(),
    correctAnswers: z.number().int(),
    scorePercentage: z.number().min(0).max(100),
    isPassed: z.boolean(),
    durationSeconds: z.number().int().nullable(),
    answers: z.array(QuizAnswerResultSchema),
  })
  .openapi('QuizAttemptResult')

export const QuizAttemptDetailAnswerSchema = z.object({
  questionId: z.string().uuid(),
  questionText: z.string(),
  studentAnswer: z.string().nullable(),
  isCorrect: z.boolean(),
  correctAnswer: z.string(),
  explanation: z.string().nullable(),
})

export const QuizAttemptDetailSchema = z
  .object({
    id: z.string().uuid(),
    lessonId: z.string().uuid(),
    attemptNumber: z.number().int(),
    totalQuestions: z.number().int(),
    correctAnswers: z.number().int(),
    scorePercentage: z.number(),
    isPassed: z.boolean(),
    durationSeconds: z.number().int().nullable(),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    answers: z.array(QuizAttemptDetailAnswerSchema),
  })
  .openapi('QuizAttemptDetail')

// ── GET /resources/{resourceId}/quiz ───────────────────────────────────────

export const GetQuizParamsSchema = z.object({
  resourceId: z.string().uuid(),
})

export const GetQuizResponseSchema = singleResponseSchema(QuizQuestionSetSchema)

// ── POST /resources/{resourceId}/quiz/submit ───────────────────────────────

export const QuizSubmitAnswerSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.string().max(10000),
})

export const QuizSubmitRequestBodySchema = z.object({
  answers: z.array(QuizSubmitAnswerSchema).min(1),
  startedAt: z.string().datetime(),
})

export const SubmitQuizParamsSchema = z.object({
  resourceId: z.string().uuid(),
})

export const SubmitQuizResponseSchema = singleResponseSchema(QuizAttemptResultSchema)

// ── GET /resources/{resourceId}/quiz/attempts ──────────────────────────────

export const ListQuizAttemptsParamsSchema = z.object({
  resourceId: z.string().uuid(),
})

export const ListQuizAttemptsQuerySchema = z.object({
  cursor: z.string().optional().describe('Opaque cursor for pagination'),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional().describe('Page size'),
})

export const QuizAttemptSummarySchema = z
  .object({
    id: z.string().uuid(),
    attemptNumber: z.number().int(),
    totalQuestions: z.number().int(),
    correctAnswers: z.number().int(),
    scorePercentage: z.number(),
    isPassed: z.boolean(),
    durationSeconds: z.number().int().nullable(),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
  })
  .openapi('QuizAttemptSummary')

export const ListQuizAttemptsResponseSchema =
  cursorPaginatedResponseSchema(QuizAttemptSummarySchema)

// ── GET /quiz/attempts/{attemptId} ─────────────────────────────────────────

export const GetQuizAttemptParamsSchema = z.object({
  attemptId: z.string().uuid(),
})

export const GetQuizAttemptResponseSchema = singleResponseSchema(QuizAttemptDetailSchema)
