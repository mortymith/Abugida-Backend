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

function forbidden(c: Context<AppEnv>, detail: string) {
  return c.json(
    {
      type: 'https://api.abugida.com/errors/forbidden',
      title: 'Forbidden',
      status: 403,
      detail,
      instance: c.req.path,
    } as const,
    403,
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

function conflict(c: Context<AppEnv>, detail: string) {
  return c.json(
    {
      type: 'https://api.abugida.com/errors/conflict',
      title: 'Conflict',
      status: 409,
      detail,
      instance: c.req.path,
    } as const,
    409,
  )
}

function serviceUnavailable(c: Context<AppEnv>, detail: string) {
  return c.json(
    {
      type: 'https://api.abugida.com/errors/service-unavailable',
      title: 'Service Unavailable',
      status: 503,
      detail,
      instance: c.req.path,
    } as const,
    503,
  )
}

// ── Handlers ───────────────────────────────────────────────────────────────

export function createDownloadsHandlers(service: DownloadsService) {
  return {
    async initiateDownload(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      const courseId = c.req.param('courseId')
      if (!courseId) return notFound(c, 'Course ID is required.')

      try {
        const result = await service.initiateDownload(user.id, courseId)
        return c.json({ data: result })
      } catch (error) {
        if (error instanceof NotFoundError) return notFound(c, error.message)
        if (error instanceof ForbiddenError) return forbidden(c, error.message)
        if (error instanceof DownloadLimitExceededError) return conflict(c, error.message)
        throw error
      }
    },

    async getDownloadStatus(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      const courseId = c.req.param('courseId')
      if (!courseId) return notFound(c, 'Course ID is required.')

      try {
        const result = await service.getDownloadStatus(user.id, courseId)
        return c.json({ data: result })
      } catch (error) {
        if (error instanceof NotFoundError) return notFound(c, error.message)
        if (error instanceof ForbiddenError) return forbidden(c, error.message)
        throw error
      }
    },

    async getPresignedUrl(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      const courseId = c.req.param('courseId')
      if (!courseId) return notFound(c, 'Course ID is required.')

      try {
        const result = await service.getPresignedUrl(user.id, courseId)
        return c.json({ data: result })
      } catch (error) {
        if (error instanceof NotFoundError) return notFound(c, error.message)
        if (error instanceof ForbiddenError) return forbidden(c, error.message)
        if (error instanceof DownloadLimitExceededError) return conflict(c, error.message)
        if (error instanceof StorageUnavailableError) return serviceUnavailable(c, error.message)
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
