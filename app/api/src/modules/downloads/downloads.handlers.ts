/**
 * @module downloads.handlers
 *
 * Route handler implementations for the downloads feature module.
 */

import type { Context } from 'hono'
import type { DownloadsService } from './downloads.service'
import {
  NotFoundError,
  ForbiddenError,
  DownloadLimitExceededError,
  StorageUnavailableError,
} from './downloads.service'
import type { AppEnv } from '@/middleware/types'
import { problemResponse } from '@/middleware'

// ── Handlers ───────────────────────────────────────────────────────────────

export function createDownloadsHandlers(service: DownloadsService) {
  return {
    async initiateDownload(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return problemResponse(c, { status: 401, detail: 'Authentication required.' })

      const courseId = c.req.param('courseId')
      if (!courseId) return problemResponse(c, { status: 404, detail: 'Course ID is required.' })

      try {
        const result = await service.initiateDownload(user.id, courseId)
        return c.json({ data: result })
      } catch (error) {
        if (error instanceof NotFoundError)
          return problemResponse(c, { status: 404, detail: error.message })
        if (error instanceof ForbiddenError)
          return problemResponse(c, { status: 403, detail: error.message })
        if (error instanceof DownloadLimitExceededError)
          return problemResponse(c, { status: 409, detail: error.message })
        throw error
      }
    },

    async getDownloadStatus(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return problemResponse(c, { status: 401, detail: 'Authentication required.' })

      const courseId = c.req.param('courseId')
      if (!courseId) return problemResponse(c, { status: 404, detail: 'Course ID is required.' })

      try {
        const result = await service.getDownloadStatus(user.id, courseId)
        return c.json({ data: result })
      } catch (error) {
        if (error instanceof NotFoundError)
          return problemResponse(c, { status: 404, detail: error.message })
        if (error instanceof ForbiddenError)
          return problemResponse(c, { status: 403, detail: error.message })
        throw error
      }
    },

    async getPresignedUrl(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return problemResponse(c, { status: 401, detail: 'Authentication required.' })

      const courseId = c.req.param('courseId')
      if (!courseId) return problemResponse(c, { status: 404, detail: 'Course ID is required.' })

      try {
        const result = await service.getPresignedUrl(user.id, courseId)
        return c.json({ data: result })
      } catch (error) {
        if (error instanceof NotFoundError)
          return problemResponse(c, { status: 404, detail: error.message })
        if (error instanceof ForbiddenError)
          return problemResponse(c, { status: 403, detail: error.message })
        if (error instanceof DownloadLimitExceededError)
          return problemResponse(c, { status: 409, detail: error.message })
        if (error instanceof StorageUnavailableError)
          return problemResponse(c, { status: 503, detail: error.message })
        throw error
      }
    },
  }
}

// ── Route-to-handler mapping ───────────────────────────────────────────────

import {
  initiateDownloadRoute,
  getDownloadStatusRoute,
  getPresignedUrlRoute,
} from './downloads.routes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (c: any) => Promise<any>

export function createDownloadsRouteMap(handlers: ReturnType<typeof createDownloadsHandlers>) {
  return [
    { route: initiateDownloadRoute, handler: handlers.initiateDownload as AnyHandler },
    { route: getDownloadStatusRoute, handler: handlers.getDownloadStatus as AnyHandler },
    { route: getPresignedUrlRoute, handler: handlers.getPresignedUrl as AnyHandler },
  ] as const
}
