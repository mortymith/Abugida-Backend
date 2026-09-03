/**
 * @module quizzes.handlers
 *
 * Route handler implementations for the quizzes feature module.
 */

import type { Context } from 'hono'
import type { QuizzesService } from './quizzes.service'
import {
  LessonNotFoundError,
  LessonNotQuizTypeError,
  EnrollmentRequiredError,
  QuizAttemptNotFoundError,
} from './quizzes.service'
import type { AppEnv } from '@/middleware/types'

// ── Helpers ────────────────────────────────────────────────────────────────

function unauthorized(c: Context<AppEnv>, detail = 'Authentication required.') {
  return c.json(
    {
      type: 'https://api.abugida.com/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail,
      instance: c.req.path,
    } as const,
    401,
  )
}

function notFound(c: Context<AppEnv>, detail: string) {
  return c.json(
    {
      type: 'https://api.abugida.com/errors/not-found',
      title: 'Not Found',
      status: 404,
      detail,
      instance: c.req.path,
    } as const,
    404,
  )
}

function unprocessableEntity(c: Context<AppEnv>, detail: string) {
  return c.json(
    {
      type: 'https://api.abugida.com/errors/unprocessable-entity',
      title: 'Unprocessable Entity',
      status: 422,
      detail,
      instance: c.req.path,
    } as const,
    422,
  )
}

// ── Handlers ───────────────────────────────────────────────────────────────

export function createQuizzesHandlers(service: QuizzesService) {
  return {
    async getQuizQuestions(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      const resourceId = c.req.param('resourceId') as string

      try {
        const result = await service.getQuizQuestions(user.id, resourceId)
        return c.json({ data: result })
      } catch (error) {
        if (error instanceof LessonNotFoundError) return notFound(c, 'Lesson not found.')
        if (error instanceof LessonNotQuizTypeError)
          return unprocessableEntity(c, 'Lesson is not a quiz type.')
        if (error instanceof EnrollmentRequiredError)
          return notFound(c, 'You must be enrolled in this course to access the quiz.')
        throw error
      }
    },

    async submitQuiz(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      const resourceId = c.req.param('resourceId') as string
      const body = await c.req.json()

      try {
        const result = await service.submitQuiz(user.id, resourceId, {
          answers: body.answers,
          startedAt: body.startedAt,
        })
        return c.json({ data: result }, 201)
      } catch (error) {
        if (error instanceof LessonNotFoundError) return notFound(c, 'Lesson not found.')
        if (error instanceof LessonNotQuizTypeError)
          return unprocessableEntity(c, 'Lesson is not a quiz type.')
        if (error instanceof EnrollmentRequiredError)
          return notFound(c, 'You must be enrolled in this course to access the quiz.')
        throw error
      }
    },

    async listQuizAttempts(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      const resourceId = c.req.param('resourceId') as string
      const query = c.req.query()

      try {
        const result = await service.listQuizAttempts(user.id, resourceId, {
          cursor: query.cursor,
          limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
        })
        return c.json(result)
      } catch (error) {
        if (error instanceof LessonNotFoundError) return notFound(c, 'Lesson not found.')
        if (error instanceof LessonNotQuizTypeError)
          return unprocessableEntity(c, 'Lesson is not a quiz type.')
        throw error
      }
    },

    async getQuizAttempt(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      const attemptId = c.req.param('attemptId') as string

      try {
        const result = await service.getQuizAttempt(user.id, attemptId)
        return c.json({ data: result })
      } catch (error) {
        if (error instanceof QuizAttemptNotFoundError) return notFound(c, 'Quiz attempt not found.')
        throw error
      }
    },
  }
}

// ── Route-to-handler mapping ───────────────────────────────────────────────

import {
  getQuizQuestionsRoute,
  submitQuizRoute,
  listQuizAttemptsRoute,
  getQuizAttemptRoute,
} from './quizzes.routes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (c: any) => Promise<any>

export function createQuizzesRouteMap(handlers: ReturnType<typeof createQuizzesHandlers>) {
  return [
    { route: getQuizQuestionsRoute, handler: handlers.getQuizQuestions as AnyHandler },
    { route: submitQuizRoute, handler: handlers.submitQuiz as AnyHandler },
    { route: listQuizAttemptsRoute, handler: handlers.listQuizAttempts as AnyHandler },
    { route: getQuizAttemptRoute, handler: handlers.getQuizAttempt as AnyHandler },
  ] as const
}
