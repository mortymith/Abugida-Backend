/**
 * @module modules
 *
 * Barrel export for all feature modules. Import module factories, repositories,
 * services, and handlers from this entry point instead of reaching into
 * individual module directories.
 */

export { createSystemHandlers, createSystemRouteMap, registerSystemDocumentation } from './system'

export {
  createUserRepository,
  createUsersService,
  createUsersHandlers,
  createUsersRouteMap,
} from './users'

export {
  createEnrollmentsRepository,
  createEnrollmentsService,
  createEnrollmentsHandlers,
  createEnrollmentsRouteMap,
} from './enrollments'

export {
  createBookmarksRepository,
  createBookmarksService,
  createBookmarksHandlers,
  createBookmarksRouteMap,
} from './bookmarks'

export {
  createRecommendationsRepository,
  createRecommendationsService,
  createRecommendationsHandlers,
  createRecommendationsRouteMap,
} from './recommendations'

export {
  createExamTypesRepository,
  createExamTypesService,
  createExamTypesHandlers,
  createExamTypesRouteMap,
} from './exam-types'

export {
  createTagsRepository,
  createTagsService,
  createTagsHandlers,
  createTagsRouteMap,
} from './tags'

export {
  createResourcesRepository,
  createResourcesService,
  createResourcesHandlers,
  createResourcesRouteMap,
} from './resources'

export {
  createBundlesRepository,
  createBundlesService,
  createBundlesHandlers,
  createBundlesRouteMap,
} from './bundles'

export {
  createDownloadsRepository,
  createDownloadsService,
  createDownloadsHandlers,
  createDownloadsRouteMap,
} from './downloads'

export {
  createPurchasesRepository,
  createPurchasesService,
  createPurchasesHandlers,
  createPurchasesRouteMap,
} from './purchases'

export {
  createQuizzesRepository,
  createQuizzesService,
  createQuizzesHandlers,
  createQuizzesRouteMap,
} from './quizzes'

export {
  createWebhooksRepository,
  createWebhooksService,
  createWebhooksHandlers,
  createWebhooksRouteMap,
} from './webhooks'
