/**
 * @module users.handlers
 *
 * Route handler implementations for the users feature module. Handlers are
 * thin — they extract the authenticated principal, delegate to the service
 * layer, and return typed responses.
 */

import type { Context } from 'hono'
import type { UsersService } from './users.service'
import {
  UserNotFoundError,
  DeviceLimitExceededError,
  DeviceNotFoundError,
  ConflictError,
} from './users.service'
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

function validationError(c: Context<AppEnv>, detail: string) {
  return c.json(
    {
      type: 'https://api.abugida.com/errors/validation',
      title: 'Unprocessable Entity',
      status: 422,
      detail,
      instance: c.req.path,
    } as const,
    422,
  )
}

// ── Handlers ───────────────────────────────────────────────────────────────

export function createUsersHandlers(service: UsersService) {
  return {
    async getProfile(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      try {
        const profile = await service.getProfile(user.id)
        return c.json({ data: profile })
      } catch (error) {
        if (error instanceof UserNotFoundError) return notFound(c, error.message)
        throw error
      }
    },

    async updateProfile(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      const body = await c.req.json()
      try {
        const profile = await service.updateProfile(user.id, body)
        return c.json({ data: profile })
      } catch (error) {
        if (error instanceof UserNotFoundError) return notFound(c, error.message)
        if (error instanceof Error) return validationError(c, error.message)
        throw error
      }
    },

    async deleteAccount(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      const body = await c.req.json()
      if (body.confirmation !== 'DELETE_MY_ACCOUNT') {
        return validationError(c, 'Confirmation must be exactly "DELETE_MY_ACCOUNT".')
      }

      try {
        const result = await service.deleteAccount(user.id)
        return c.json({ message: 'Account deletion scheduled.', ...result }, 202)
      } catch (error) {
        if (error instanceof UserNotFoundError) return notFound(c, error.message)
        throw error
      }
    },

    async getOnboarding(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      try {
        const state = await service.getOnboarding(user.id)
        return c.json({ data: state })
      } catch (error) {
        if (error instanceof UserNotFoundError) return notFound(c, error.message)
        throw error
      }
    },

    async updateOnboarding(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      const { step } = await c.req.json()
      try {
        const state = await service.updateOnboarding(user.id, step)
        return c.json({ data: state })
      } catch (error) {
        if (error instanceof UserNotFoundError) return notFound(c, error.message)
        throw error
      }
    },

    async retriggerOnboarding(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      try {
        await service.retriggerOnboarding(user.id)
        return c.json({ message: 'Onboarding retriggered.' })
      } catch (error) {
        if (error instanceof UserNotFoundError) return notFound(c, error.message)
        throw error
      }
    },

    async getConsents(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      try {
        const consents = await service.getConsents(user.id)
        return c.json({ data: consents })
      } catch (error) {
        if (error instanceof UserNotFoundError) return notFound(c, error.message)
        throw error
      }
    },

    async updateConsents(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      const { consents } = await c.req.json()
      try {
        await service.updateConsents(user.id, consents)
        return c.json({ message: 'Consents updated.' })
      } catch (error) {
        if (error instanceof UserNotFoundError) return notFound(c, error.message)
        if (error instanceof ConflictError) return conflict(c, error.message)
        throw error
      }
    },

    async exportData(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      const query = c.req.query()
      const include = query.include?.split(',').map((s) => s.trim()) ?? undefined
      const format = (query.format as 'json' | 'csv') ?? undefined

      try {
        const result = await service.exportData(user.id, { include, format })
        return c.json({
          data: result,
          meta: {
            format: format ?? 'json',
            exportedAt: new Date().toISOString(),
          },
        })
      } catch (error) {
        if (error instanceof UserNotFoundError) return notFound(c, error.message)
        throw error
      }
    },

    async getDevices(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      try {
        const devices = await service.getDevices(user.id)
        return c.json({ data: devices })
      } catch (error) {
        if (error instanceof UserNotFoundError) return notFound(c, error.message)
        throw error
      }
    },

    async registerDevice(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      const body = await c.req.json()
      try {
        const device = await service.registerDevice(user.id, body)
        return c.json({ data: device }, 201)
      } catch (error) {
        if (error instanceof UserNotFoundError) return notFound(c, error.message)
        if (error instanceof DeviceLimitExceededError) return conflict(c, error.message)
        throw error
      }
    },

    async updateDevice(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      const deviceId = c.req.param('deviceId')
      if (!deviceId) return notFound(c, 'Device ID is required.')
      const body = await c.req.json()
      try {
        const device = await service.updateDevice(user.id, deviceId, body)
        return c.json({ data: device })
      } catch (error) {
        if (error instanceof UserNotFoundError) return notFound(c, error.message)
        if (error instanceof DeviceNotFoundError) return notFound(c, error.message)
        throw error
      }
    },

    async removeDevice(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      const deviceId = c.req.param('deviceId')
      if (!deviceId) return notFound(c, 'Device ID is required.')
      try {
        await service.removeDevice(user.id, deviceId)
        return c.body(null, 204)
      } catch (error) {
        if (error instanceof UserNotFoundError) return notFound(c, error.message)
        if (error instanceof DeviceNotFoundError) return notFound(c, error.message)
        throw error
      }
    },

    async getDashboard(c: Context<AppEnv>) {
      const user = c.get('user')
      if (!user) return unauthorized(c)

      try {
        const dashboard = await service.getDashboard(user.id)
        return c.json({ data: dashboard }, 200, {
          'Cache-Control': 'private, max-age=60',
        })
      } catch (error) {
        if (error instanceof UserNotFoundError) return notFound(c, error.message)
        throw error
      }
    },
  }
}

// ── Route-to-handler mapping ───────────────────────────────────────────────

import {
  getProfileRoute,
  updateProfileRoute,
  deleteAccountRoute,
  getOnboardingRoute,
  updateOnboardingRoute,
  retriggerOnboardingRoute,
  getConsentsRoute,
  updateConsentsRoute,
  exportDataRoute,
  getDevicesRoute,
  registerDeviceRoute,
  updateDeviceRoute,
  removeDeviceRoute,
  getDashboardRoute,
} from './users.routes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (c: any) => Promise<any>

export function createUsersRouteMap(handlers: ReturnType<typeof createUsersHandlers>) {
  return [
    { route: getProfileRoute, handler: handlers.getProfile as AnyHandler },
    { route: updateProfileRoute, handler: handlers.updateProfile as AnyHandler },
    { route: deleteAccountRoute, handler: handlers.deleteAccount as AnyHandler },
    { route: getOnboardingRoute, handler: handlers.getOnboarding as AnyHandler },
    { route: updateOnboardingRoute, handler: handlers.updateOnboarding as AnyHandler },
    { route: retriggerOnboardingRoute, handler: handlers.retriggerOnboarding as AnyHandler },
    { route: getConsentsRoute, handler: handlers.getConsents as AnyHandler },
    { route: updateConsentsRoute, handler: handlers.updateConsents as AnyHandler },
    { route: exportDataRoute, handler: handlers.exportData as AnyHandler },
    { route: getDevicesRoute, handler: handlers.getDevices as AnyHandler },
    { route: registerDeviceRoute, handler: handlers.registerDevice as AnyHandler },
    { route: updateDeviceRoute, handler: handlers.updateDevice as AnyHandler },
    { route: removeDeviceRoute, handler: handlers.removeDevice as AnyHandler },
    { route: getDashboardRoute, handler: handlers.getDashboard as AnyHandler },
  ] as const
}
