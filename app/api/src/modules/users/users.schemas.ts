/**
 * @module users.schemas
 *
 * Zod schemas for the users feature module. These define request/response
 * validation contracts and are colocated with OpenAPI route definitions
 * for automatic spec generation.
 */

import { z } from '@hono/zod-openapi'

// ── Shared error schemas ───────────────────────────────────────────────────

export const ProblemDetailSchema = z
  .object({
    type: z.string().url(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    instance: z.string(),
    correlationId: z.string().uuid().optional(),
  })
  .openapi('ProblemDetail')

export const UnauthorizedSchema = ProblemDetailSchema.extend({
  status: z.literal(401),
}).openapi('Unauthorized')

export const NotFoundSchema = ProblemDetailSchema.extend({
  status: z.literal(404),
}).openapi('NotFound')

export const ConflictSchema = ProblemDetailSchema.extend({
  status: z.literal(409),
}).openapi('Conflict')

export const ValidationErrorSchema = ProblemDetailSchema.extend({
  status: z.literal(422),
}).openapi('ValidationError')

export const TooManyRequestsSchema = ProblemDetailSchema.extend({
  status: z.literal(429),
}).openapi('TooManyRequests')

export const InternalErrorSchema = ProblemDetailSchema.extend({
  status: z.literal(500),
}).openapi('InternalError')

// ── Single response wrapper ────────────────────────────────────────────────

export function singleResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z
    .object({
      data: dataSchema,
    })
    .openapi('SingleResponse')
}

// ── GET /users/me ──────────────────────────────────────────────────────────

export const UserProfileSchema = z
  .object({
    id: z.string().uuid(),
    displayName: z.string().max(100).nullable(),
    email: z.string().email(),
    avatarUrl: z.string().url().nullable(),
    educationSegment: z.enum(['toefl', 'igcse', 'high_school', 'college']).nullable(),
    notificationPreferences: z.record(z.string(), z.unknown()),
    languagePreference: z.string().max(10),
    timezone: z.string().max(50),
    examPreferences: z.array(z.unknown()),
    isOnboardingCompleted: z.boolean(),
    onboardingStep: z.number().int().min(0).max(5),
    accountStatus: z.enum(['pending_verification', 'active', 'locked', 'suspended', 'deleted']),
    createdAt: z.string().datetime(),
  })
  .openapi('UserProfile')

export const GetProfileResponseSchema = singleResponseSchema(UserProfileSchema)

// ── PATCH /users/me ────────────────────────────────────────────────────────

export const UpdateProfileBodySchema = z
  .object({
    displayName: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    avatarObjectKey: z.string().max(500).optional(),
    educationSegment: z.enum(['toefl', 'igcse', 'high_school', 'college']).optional(),
    languagePreference: z.string().max(10).optional(),
    timezone: z.string().max(50).optional(),
    notificationPreferences: z.record(z.string(), z.unknown()).optional(),
    examPreferences: z.array(z.unknown()).optional(),
  })
  .strict()
  .openapi('UserProfileUpdate')

export const UpdateProfileResponseSchema = singleResponseSchema(UserProfileSchema)

// ── DELETE /users/me ───────────────────────────────────────────────────────

export const DeleteAccountBodySchema = z
  .object({
    confirmation: z.literal('DELETE_MY_ACCOUNT'),
    reason: z.string().max(500).optional(),
    deleteAllData: z.boolean().default(true),
  })
  .strict()
  .openapi('AccountDeletionRequest')

export const DeleteAccountResponseSchema = z
  .object({
    message: z.string(),
    deletionScheduledAt: z.string().datetime(),
  })
  .openapi('AccountDeletionResponse')

// ── GET /users/me/onboarding ───────────────────────────────────────────────

export const OnboardingStateSchema = z
  .object({
    isCompleted: z.boolean(),
    currentStep: z.number().int().min(0).max(5),
  })
  .openapi('OnboardingState')

export const GetOnboardingResponseSchema = singleResponseSchema(OnboardingStateSchema)

// ── POST /users/me/onboarding ──────────────────────────────────────────────

export const OnboardingStepUpdateSchema = z
  .object({
    step: z.number().int().min(0).max(5),
  })
  .strict()
  .openapi('OnboardingStepUpdate')

export const UpdateOnboardingResponseSchema = singleResponseSchema(OnboardingStateSchema)

// ── POST /users/me/onboarding/retrigger ────────────────────────────────────

export const OnboardingRetriggerSchema = z
  .object({
    reason: z.enum(['USER_REQUESTED', 'APP_UPDATE', 'CONTENT_REFRESH']).optional(),
  })
  .strict()
  .openapi('OnboardingRetriggerRequest')

export const RetriggerOnboardingResponseSchema = z
  .object({
    message: z.string(),
  })
  .openapi('RetriggerOnboardingResponse')

// ── GET /users/me/consents ─────────────────────────────────────────────────

export const ConsentRecordSchema = z
  .object({
    consentType: z.enum([
      'essential',
      'analytics',
      'personalization',
      'marketing',
      'third_party_sharing',
    ]),
    consentVersion: z.string().max(20),
    isGranted: z.boolean(),
    consentedAt: z.string().datetime(),
  })
  .openapi('ConsentRecord')

export const GetConsentsResponseSchema = singleResponseSchema(z.array(ConsentRecordSchema))

// ── PUT /users/me/consents ─────────────────────────────────────────────────

export const ConsentUpdateItemSchema = z
  .object({
    consentType: z.enum(['marketing', 'analytics', 'personalization', 'third_party_sharing']),
    consentVersion: z.string().max(20),
    isGranted: z.boolean(),
  })
  .openapi('ConsentUpdateItem')

export const ConsentUpdateBodySchema = z
  .object({
    consents: z.array(ConsentUpdateItemSchema).min(1),
  })
  .strict()
  .openapi('ConsentUpdate')

export const UpdateConsentsResponseSchema = z
  .object({
    message: z.string(),
  })
  .openapi('UpdateConsentsResponse')

// ── GET /users/me/export ───────────────────────────────────────────────────

export const ExportQuerySchema = z.object({
  include: z
    .string()
    .optional()
    .describe('Comma-separated categories: PROFILE, PROGRESS, PURCHASES, CONSENTS'),
  format: z.enum(['json', 'csv']).default('json').optional(),
})

export const ExportDataResponseSchema = z
  .object({
    data: z.record(z.string(), z.unknown()),
    meta: z.object({
      format: z.string(),
      exportedAt: z.string().datetime(),
    }),
  })
  .openapi('ExportDataResponse')

// ── GET /users/me/devices ──────────────────────────────────────────────────

export const DeviceSchema = z
  .object({
    id: z.string().uuid(),
    deviceIdentifier: z.string().max(255),
    deviceName: z.string().max(100).nullable(),
    platform: z.enum(['ios', 'android', 'web']).nullable(),
    osVersion: z.string().max(50).nullable(),
    appVersion: z.string().max(20).nullable(),
    lastActiveAt: z.string().datetime(),
    isActive: z.boolean(),
  })
  .openapi('Device')

export const GetDevicesResponseSchema = singleResponseSchema(z.array(DeviceSchema))

// ── POST /users/me/devices ─────────────────────────────────────────────────

export const DeviceRegistrationBodySchema = z
  .object({
    deviceIdentifier: z.string().min(1).max(255),
    deviceName: z.string().max(100).optional(),
    platform: z.enum(['ios', 'android', 'web']).optional(),
    osVersion: z.string().max(50).optional(),
    appVersion: z.string().max(20).optional(),
  })
  .strict()
  .openapi('DeviceRegistrationRequest')

export const RegisterDeviceResponseSchema = singleResponseSchema(DeviceSchema)

// ── PATCH /users/me/devices/{deviceId} ─────────────────────────────────────

export const DeviceUpdateBodySchema = z
  .object({
    deviceName: z.string().max(100).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .openapi('DeviceUpdateRequest')

export const UpdateDeviceResponseSchema = singleResponseSchema(DeviceSchema)

// ── GET /users/me/dashboard ────────────────────────────────────────────────

export const UserStatsSchema = z
  .object({
    minutesToday: z.number().int(),
    lessonsToday: z.number().int(),
    xpEarned: z.number().int(),
    streakDays: z.number().int(),
    streakTarget: z.number().int(),
  })
  .openapi('UserStats')

export const ActivityItemSchema = z
  .object({
    id: z.string().uuid(),
    type: z.enum(['SESSION', 'COMPLETION', 'ENROLLMENT', 'ACHIEVEMENT', 'STREAK', 'MILESTONE']),
    title: z.string(),
    subtitle: z.string(),
    detail: z.string(),
    time: z.string(),
    group: z.string(),
  })
  .openapi('ActivityItem')

export const InsightSchema = z
  .object({
    id: z.string().uuid(),
    icon: z.string(),
    bgColor: z.string(),
    iconColor: z.string(),
    title: z.string(),
    description: z.string(),
  })
  .openapi('Insight')

export const WeeklySessionSchema = z
  .object({
    course: z.string(),
    lesson: z.string(),
    duration: z.string(),
  })
  .openapi('WeeklySession')

export const WeeklyDataSchema = z
  .object({
    barHeights: z.array(z.number()),
    dayTotals: z.array(z.string()),
    sessions: z.record(z.string(), z.array(WeeklySessionSchema)),
  })
  .openapi('WeeklyData')

export const DeadlineSchema = z
  .object({
    title: z.string(),
    date: z.string(),
    daysLeft: z.number().int(),
    color: z.string(),
  })
  .openapi('Deadline')

export const JumpBackItemSchema = z
  .object({
    title: z.string(),
    progress: z.number().int(),
    imageSeed: z.string(),
  })
  .openapi('JumpBackItem')

export const DashboardDataSchema = z
  .object({
    userStats: UserStatsSchema,
    recentActivity: z.array(ActivityItemSchema),
    insights: z.array(InsightSchema),
    weeklyData: WeeklyDataSchema,
    deadlines: z.array(DeadlineSchema),
    jumpBack: JumpBackItemSchema,
  })
  .openapi('DashboardData')

export const GetDashboardResponseSchema = singleResponseSchema(DashboardDataSchema)
