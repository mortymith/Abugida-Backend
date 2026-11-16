/**
 * @module modules
 *
 * Barrel export for all feature modules. Import module factories, repositories,
 * services, and handlers from this entry point instead of reaching into
 * individual module directories.
 */

export {
  createSystemHandlers,
  createSystemRouteMap,
  registerSystemDocumentation,
} from '#/modules/system'

export {
  createUserRepository,
  createUsersService,
  createUsersHandlers,
  createUsersRouteMap,
} from '#/modules/users'

export {
  createEnrollmentsRepository,
  createEnrollmentsService,
  createEnrollmentsHandlers,
  createEnrollmentsRouteMap,
} from '#/modules/enrollments'

export {
  createBookmarksRepository,
  createBookmarksService,
  createBookmarksHandlers,
  createBookmarksRouteMap,
} from '#/modules/bookmarks'

export {
  createRecommendationsRepository,
  createRecommendationsService,
  createRecommendationsHandlers,
  createRecommendationsRouteMap,
} from '#/modules/recommendations'

export {
  createExamTypesRepository,
  createExamTypesService,
  createExamTypesHandlers,
  createExamTypesRouteMap,
} from '#/modules/exam-types'

export {
  createTagsRepository,
  createTagsService,
  createTagsHandlers,
  createTagsRouteMap,
} from '#/modules/tags'

export {
  createResourcesRepository,
  createResourcesService,
  createResourcesHandlers,
  createResourcesRouteMap,
} from '#/modules/resources'

export {
  createBundlesRepository,
  createBundlesService,
  createBundlesHandlers,
  createBundlesRouteMap,
} from '#/modules/bundles'

export {
  createDownloadsRepository,
  createDownloadsService,
  createDownloadsHandlers,
  createDownloadsRouteMap,
} from '#/modules/downloads'

export {
  createPurchasesRepository,
  createPurchasesService,
  createPurchasesHandlers,
  createPurchasesRouteMap,
} from '#/modules/purchases'

export {
  createQuizzesRepository,
  createQuizzesService,
  createQuizzesHandlers,
  createQuizzesRouteMap,
} from '#/modules/quizzes'

export {
  createWebhooksRepository,
  createWebhooksService,
  createWebhooksHandlers,
  createWebhooksRouteMap,
} from '#/modules/webhooks'
