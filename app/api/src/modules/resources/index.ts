/**
 * @module resources
 *
 * Resources feature module — educational content hierarchy (courses, modules,
 * lessons/resources) with public access.
 *
 * Usage in app.ts:
 * ```ts
 * import { createResourcesHandlers, createResourcesRouteMap, createResourcesRepository, createResourcesService } from './modules/resources'
 *
 * const resourcesRepo = createResourcesRepository(db)
 * const resourcesService = createResourcesService(resourcesRepo)
 * const resourcesHandlers = createResourcesHandlers(resourcesService)
 * for (const { route, handler } of createResourcesRouteMap(resourcesHandlers)) {
 *   app.openapi(route, handler)
 * }
 * ```
 */

export {
  listCoursesByExamTypeRoute,
  getCourseRoute,
  getCourseCurriculumRoute,
  listModulesRoute,
  listModuleLessonsRoute,
  getResourceRoute,
} from './resources.routes'

export type {
  ListCoursesByExamTypeRoute,
  GetCourseRoute,
  GetCourseCurriculumRoute,
  ListModulesRoute,
  ListModuleLessonsRoute,
  GetResourceRoute,
} from './resources.routes'

export { createResourcesHandlers, createResourcesRouteMap } from './resources.handlers'

export { createResourcesRepository, type ResourcesRepository } from './resources.repository'

export { createResourcesService, NotFoundError, type ResourcesService } from './resources.service'

export type {
  CourseListView,
  CourseDetailView,
  CourseCurriculumView,
  ModuleSummaryView,
  LessonSummaryView,
  ResourceDetailView,
  CourseListQuery,
  LessonListQuery,
} from './resources.types'
