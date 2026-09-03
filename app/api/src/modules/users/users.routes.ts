/**
 * @module users.routes
 *
 * OpenAPI route definitions for the users feature module. Each route is
 * defined with colocated Zod request/response schemas for automatic spec
 * generation and runtime validation.
 */

import { createRoute, z } from '@hono/zod-openapi'
import {
  UnauthorizedSchema,
  NotFoundSchema,
  ConflictSchema,
  ValidationErrorSchema,
  TooManyRequestsSchema,
  GetProfileResponseSchema,
  UpdateProfileBodySchema,
  UpdateProfileResponseSchema,
  DeleteAccountBodySchema,
  DeleteAccountResponseSchema,
  GetOnboardingResponseSchema,
  OnboardingStepUpdateSchema,
  UpdateOnboardingResponseSchema,
  OnboardingRetriggerSchema,
  RetriggerOnboardingResponseSchema,
  GetConsentsResponseSchema,
  ConsentUpdateBodySchema,
  UpdateConsentsResponseSchema,
  ExportQuerySchema,
  ExportDataResponseSchema,
  GetDevicesResponseSchema,
  DeviceRegistrationBodySchema,
  RegisterDeviceResponseSchema,
  DeviceUpdateBodySchema,
  UpdateDeviceResponseSchema,
  GetDashboardResponseSchema,
} from './users.schemas'

// ── GET /users/me ──────────────────────────────────────────────────────────

export const getProfileRoute = createRoute({
  method: 'get',
  path: '/users/me',
  tags: ['Users'],
  summary: 'Get current user profile',
  description: 'Returns the authenticated user profile with all settings.',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'User profile.',
      content: { 'application/json': { schema: GetProfileResponseSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    404: {
      description: 'User not found.',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type GetProfileRoute = typeof getProfileRoute

// ── PATCH /users/me ────────────────────────────────────────────────────────

export const updateProfileRoute = createRoute({
  method: 'patch',
  path: '/users/me',
  tags: ['Users'],
  summary: 'Update current user profile',
  description: 'Partially updates the user profile fields. Only provided fields are modified.',
  security: [{ Bearer: [] }],
  request: {
    body: {
      description: 'Profile fields to update.',
      content: { 'application/json': { schema: UpdateProfileBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Profile updated.',
      content: { 'application/json': { schema: UpdateProfileResponseSchema } },
    },
    400: {
      description: 'Invalid request body.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    404: {
      description: 'User not found.',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    409: {
      description: 'Conflict (e.g. email already in use).',
      content: { 'application/problem+json': { schema: ConflictSchema } },
    },
    422: {
      description: 'Validation error.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type UpdateProfileRoute = typeof updateProfileRoute

// ── DELETE /users/me ───────────────────────────────────────────────────────

export const deleteAccountRoute = createRoute({
  method: 'delete',
  path: '/users/me',
  tags: ['Users'],
  summary: 'Delete current user account',
  description:
    'Initiates GDPR-compliant account deletion. The account enters a 30-day grace period before permanent removal.',
  security: [{ Bearer: [] }],
  request: {
    body: {
      description: 'Deletion confirmation and optional reason.',
      content: { 'application/json': { schema: DeleteAccountBodySchema } },
      required: true,
    },
  },
  responses: {
    202: {
      description: 'Deletion scheduled.',
      content: { 'application/json': { schema: DeleteAccountResponseSchema } },
    },
    400: {
      description: 'Invalid confirmation string.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    404: {
      description: 'User not found.',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type DeleteAccountRoute = typeof deleteAccountRoute

// ── GET /users/me/onboarding ───────────────────────────────────────────────

export const getOnboardingRoute = createRoute({
  method: 'get',
  path: '/users/me/onboarding',
  tags: ['Users'],
  summary: 'Get onboarding progress',
  description: 'Returns the current onboarding state and completed step.',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'Onboarding state.',
      content: { 'application/json': { schema: GetOnboardingResponseSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type GetOnboardingRoute = typeof getOnboardingRoute

// ── POST /users/me/onboarding ──────────────────────────────────────────────

export const updateOnboardingRoute = createRoute({
  method: 'post',
  path: '/users/me/onboarding',
  tags: ['Users'],
  summary: 'Update onboarding progress',
  description: 'Advances or sets the onboarding step. Step 5 marks onboarding as completed.',
  security: [{ Bearer: [] }],
  request: {
    body: {
      description: 'Onboarding step to set.',
      content: { 'application/json': { schema: OnboardingStepUpdateSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Onboarding state updated.',
      content: { 'application/json': { schema: UpdateOnboardingResponseSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    409: {
      description: 'Conflict.',
      content: { 'application/problem+json': { schema: ConflictSchema } },
    },
    422: {
      description: 'Validation error.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type UpdateOnboardingRoute = typeof updateOnboardingRoute

// ── POST /users/me/onboarding/retrigger ────────────────────────────────────

export const retriggerOnboardingRoute = createRoute({
  method: 'post',
  path: '/users/me/onboarding/retrigger',
  tags: ['Users'],
  summary: 'Retrigger onboarding flow',
  description: 'Resets the onboarding progress so the user can go through it again.',
  security: [{ Bearer: [] }],
  request: {
    body: {
      description: 'Optional retrigger reason.',
      content: { 'application/json': { schema: OnboardingRetriggerSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Onboarding retriggered.',
      content: { 'application/json': { schema: RetriggerOnboardingResponseSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    422: {
      description: 'Validation error.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type RetriggerOnboardingRoute = typeof retriggerOnboardingRoute

// ── GET /users/me/consents ─────────────────────────────────────────────────

export const getConsentsRoute = createRoute({
  method: 'get',
  path: '/users/me/consents',
  tags: ['Users'],
  summary: 'Get user consent records',
  description: 'Returns all consent records for the authenticated user.',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'Consent records.',
      content: { 'application/json': { schema: GetConsentsResponseSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type GetConsentsRoute = typeof getConsentsRoute

// ── PUT /users/me/consents ─────────────────────────────────────────────────

export const updateConsentsRoute = createRoute({
  method: 'put',
  path: '/users/me/consents',
  tags: ['Users'],
  summary: 'Update user consents',
  description:
    'Creates new immutable consent records. The ESSENTIAL consent type is always granted and cannot be modified.',
  security: [{ Bearer: [] }],
  request: {
    body: {
      description: 'Consent updates.',
      content: { 'application/json': { schema: ConsentUpdateBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Consents updated.',
      content: { 'application/json': { schema: UpdateConsentsResponseSchema } },
    },
    400: {
      description: 'Invalid request.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    409: {
      description: 'Conflict.',
      content: { 'application/problem+json': { schema: ConflictSchema } },
    },
    422: {
      description: 'Validation error.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type UpdateConsentsRoute = typeof updateConsentsRoute

// ── GET /users/me/export ───────────────────────────────────────────────────

export const exportDataRoute = createRoute({
  method: 'get',
  path: '/users/me/export',
  tags: ['Users'],
  summary: 'Export user data',
  description: 'GDPR data export. Returns streaming JSON or CSV with selected data categories.',
  security: [{ Bearer: [] }],
  request: {
    query: ExportQuerySchema,
  },
  responses: {
    200: {
      description: 'Exported data.',
      content: { 'application/json': { schema: ExportDataResponseSchema } },
    },
    400: {
      description: 'Invalid query parameters.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type ExportDataRoute = typeof exportDataRoute

// ── GET /users/me/devices ──────────────────────────────────────────────────

export const getDevicesRoute = createRoute({
  method: 'get',
  path: '/users/me/devices',
  tags: ['Users'],
  summary: 'Get registered devices',
  description: 'Returns all devices registered to the authenticated user.',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'Registered devices.',
      content: { 'application/json': { schema: GetDevicesResponseSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type GetDevicesRoute = typeof getDevicesRoute

// ── POST /users/me/devices ─────────────────────────────────────────────────

export const registerDeviceRoute = createRoute({
  method: 'post',
  path: '/users/me/devices',
  tags: ['Users'],
  summary: 'Register a new device',
  description: 'Registers a new device. Enforces a 3-device limit per user account.',
  security: [{ Bearer: [] }],
  request: {
    body: {
      description: 'Device details.',
      content: { 'application/json': { schema: DeviceRegistrationBodySchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'Device registered.',
      content: { 'application/json': { schema: RegisterDeviceResponseSchema } },
    },
    400: {
      description: 'Invalid request body.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    409: {
      description: 'Device limit exceeded.',
      content: { 'application/problem+json': { schema: ConflictSchema } },
    },
    422: {
      description: 'Validation error.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type RegisterDeviceRoute = typeof registerDeviceRoute

// ── PATCH /users/me/devices/{deviceId} ─────────────────────────────────────

export const updateDeviceRoute = createRoute({
  method: 'patch',
  path: '/users/me/devices/{deviceId}',
  tags: ['Users'],
  summary: 'Update device details',
  description: 'Updates device name or marks it as active/inactive.',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      deviceId: z.string().uuid(),
    }),
    body: {
      description: 'Device fields to update.',
      content: { 'application/json': { schema: DeviceUpdateBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Device updated.',
      content: { 'application/json': { schema: UpdateDeviceResponseSchema } },
    },
    400: {
      description: 'Invalid request.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    404: {
      description: 'Device not found.',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    422: {
      description: 'Validation error.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type UpdateDeviceRoute = typeof updateDeviceRoute

// ── DELETE /users/me/devices/{deviceId} ────────────────────────────────────

export const removeDeviceRoute = createRoute({
  method: 'delete',
  path: '/users/me/devices/{deviceId}',
  tags: ['Users'],
  summary: 'Remove a device',
  description: 'Removes the specified device from the user account.',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      deviceId: z.string().uuid(),
    }),
  },
  responses: {
    204: {
      description: 'Device removed.',
    },
    400: {
      description: 'Invalid request.',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    404: {
      description: 'Device not found.',
      content: { 'application/problem+json': { schema: NotFoundSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type RemoveDeviceRoute = typeof removeDeviceRoute

// ── GET /users/me/dashboard ────────────────────────────────────────────────

export const getDashboardRoute = createRoute({
  method: 'get',
  path: '/users/me/dashboard',
  tags: ['Dashboard'],
  summary: 'Get user dashboard data',
  description:
    'Aggregated dashboard data for the user home screen. Includes user statistics, recent activity feed, insights, weekly study data, upcoming deadlines, and jump-back course recommendation. Cached for 60 seconds.',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'Dashboard data.',
      headers: z.object({
        'Cache-Control': z.string().optional(),
      }),
      content: { 'application/json': { schema: GetDashboardResponseSchema } },
    },
    401: {
      description: 'Not authenticated.',
      content: { 'application/problem+json': { schema: UnauthorizedSchema } },
    },
    429: {
      description: 'Rate limit exceeded.',
      content: { 'application/problem+json': { schema: TooManyRequestsSchema } },
    },
  },
})

export type GetDashboardRoute = typeof getDashboardRoute
