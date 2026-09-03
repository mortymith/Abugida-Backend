/**
 * @module quizzes
 *
 * Quizzes feature module — quiz questions, attempts, and answer submission.
 *
 * Usage in app.ts:
 * ```ts
 * import { createQuizzesHandlers, createQuizzesRouteMap, createQuizzesRepository, createQuizzesService } from './modules/quizzes'
 *
 * const quizzesRepo = createQuizzesRepository(db)
 * const quizzesService = createQuizzesService(quizzesRepo)
 * const quizzesHandlers = createQuizzesHandlers(quizzesService)
 * for (const { route, handler } of createQuizzesRouteMap(quizzesHandlers)) {
 *   app.openapi(route, handler)
 * }
 * ```
 */

export {
  getQuizQuestionsRoute,
  submitQuizRoute,
  listQuizAttemptsRoute,
  getQuizAttemptRoute,
} from './quizzes.routes'

export type {
  GetQuizQuestionsRoute,
  SubmitQuizRoute,
  ListQuizAttemptsRoute,
  GetQuizAttemptRoute,
} from './quizzes.routes'

export { createQuizzesHandlers, createQuizzesRouteMap } from './quizzes.handlers'

export { createQuizzesRepository, type QuizzesRepository } from './quizzes.repository'

export {
  createQuizzesService,
  LessonNotFoundError,
  LessonNotQuizTypeError,
  EnrollmentRequiredError,
  QuizAttemptNotFoundError,
  type QuizzesService,
} from './quizzes.service'

export type {
  QuizQuestionView,
  QuizQuestionSetView,
  QuizSubmitRequestView,
  QuizAttemptResultView,
  QuizAttemptDetailView,
  QuizAttemptsQuery,
} from './quizzes.types'
