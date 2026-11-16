/**
 * @module enrollments
 *
 * Enrollments feature module — progress tracking, enrollment management,
 * and lesson completion handling.
 *
 * Usage in app.ts:
 * ```ts
 * import { createEnrollmentsHandlers, createEnrollmentsRouteMap, createEnrollmentsRepository, createEnrollmentsService } from '#/modules/enrollments'
 *
 * const enrollmentsRepo = createEnrollmentsRepository(db)
 * const enrollmentsService = createEnrollmentsService(enrollmentsRepo, queue)
 * const enrollmentsHandlers = createEnrollmentsHandlers(enrollmentsService)
 * for (const { route, handler } of createEnrollmentsRouteMap(enrollmentsHandlers)) {
 *   app.openapi(route, handler)
 * }
 * ```
 */

export {
  getProgressRoute,
  listEnrollmentsRoute,
  getEnrollmentRoute,
  listLessonCompletionsRoute,
  updateLessonCompletionRoute,
} from '#/modules/enrollments/enrollments.routes'

export type {
  GetProgressRoute,
  ListEnrollmentsRoute,
  GetEnrollmentRoute,
  ListLessonCompletionsRoute,
  UpdateLessonCompletionRoute,
} from '#/modules/enrollments/enrollments.routes'

export {
  createEnrollmentsHandlers,
  createEnrollmentsRouteMap,
} from '#/modules/enrollments/enrollments.handlers'

export {
  createEnrollmentsRepository,
  encodeCursor,
  decodeCursor,
  type EnrollmentsRepository,
} from '#/modules/enrollments/enrollments.repository'

export {
  createEnrollmentsService,
  EnrollmentNotFoundError,
  LessonNotFoundError,
  ConflictError,
  type EnrollmentsService,
} from '#/modules/enrollments/enrollments.service'

export type {
  ProgressStats,
  EnrollmentView,
  EnrollmentDetailView,
  LessonCompletionView,
  LessonCompletionToggle,
  EnrollmentListQuery,
  LessonCompletionListQuery,
} from '#/modules/enrollments/enrollments.types'
