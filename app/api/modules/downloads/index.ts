/**
 * @module downloads
 *
 * Downloads feature module — offline course content downloads, download status,
 * and presigned download URLs.
 *
 * Usage in app.ts:
 * ```ts
 * import { createDownloadsHandlers, createDownloadsRouteMap, createDownloadsRepository, createDownloadsService } from '#/modules/downloads'
 *
 * const downloadsRepo = createDownloadsRepository(db)
 * const downloadsService = createDownloadsService(downloadsRepo, storage)
 * const downloadsHandlers = createDownloadsHandlers(downloadsService)
 * for (const { route, handler } of createDownloadsRouteMap(downloadsHandlers)) {
 *   app.openapi(route, handler)
 * }
 * ```
 */

export {
  initiateDownloadRoute,
  getDownloadStatusRoute,
  getPresignedUrlRoute,
} from '#/modules/downloads/downloads.routes'

export type {
  InitiateDownloadRoute,
  GetDownloadStatusRoute,
  GetPresignedUrlRoute,
} from '#/modules/downloads/downloads.routes'

export {
  createDownloadsHandlers,
  createDownloadsRouteMap,
} from '#/modules/downloads/downloads.handlers'

export {
  createDownloadsRepository,
  type DownloadsRepository,
} from '#/modules/downloads/downloads.repository'

export {
  createDownloadsService,
  NotFoundError,
  ForbiddenError,
  DownloadLimitExceededError,
  StorageUnavailableError,
  type DownloadsService,
} from '#/modules/downloads/downloads.service'

export type {
  DownloadStatusView,
  PresignedDownloadUrlView,
  DownloadInitiatedView,
  CourseDownloadInfo,
} from '#/modules/downloads/downloads.types'
