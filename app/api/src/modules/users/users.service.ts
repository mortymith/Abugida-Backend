/**
 * @module users.service
 *
 * Business logic for the users feature module. Orchestrates repository calls,
 * enforces invariants, and assembles response shapes. Keeps handlers thin.
 */

import type { QueueClient } from '@abugida/queue'
import { JobType } from '@abugida/queue'
import { devices } from '@abugida/database/auth'
import type { UserRepository } from './users.repository'
import type {
  UserProfileView,
  OnboardingState,
  ConsentRecord,
  ConsentUpdateItem,
  DeviceView,
  DeviceRegistrationFields,
  DeviceUpdateFields,
  DashboardData,
  UpdateProfileFields,
  ExportOptions,
} from './users.types'

// ── Errors ─────────────────────────────────────────────────────────────────

export class UserNotFoundError extends Error {
  constructor(message = 'User not found.') {
    super(message)
    this.name = 'UserNotFoundError'
  }
}

export class DeviceLimitExceededError extends Error {
  constructor(maxDevices: number) {
    super(`Device limit exceeded. Maximum ${maxDevices} devices allowed.`)
    this.name = 'DeviceLimitExceededError'
  }
}

export class DeviceNotFoundError extends Error {
  constructor(message = 'Device not found.') {
    super(message)
    this.name = 'DeviceNotFoundError'
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

// ── Service ────────────────────────────────────────────────────────────────

export interface UsersService {
  getProfile(publicId: string): Promise<UserProfileView>
  updateProfile(publicId: string, fields: UpdateProfileFields): Promise<UserProfileView>
  deleteAccount(publicId: string): Promise<{ deletionScheduledAt: string }>
  getOnboarding(publicId: string): Promise<OnboardingState>
  updateOnboarding(publicId: string, step: number): Promise<OnboardingState>
  retriggerOnboarding(publicId: string): Promise<void>
  getConsents(publicId: string): Promise<ConsentRecord[]>
  updateConsents(publicId: string, consents: ConsentUpdateItem[]): Promise<void>
  exportData(publicId: string, options: ExportOptions): Promise<Record<string, unknown>>
  getDevices(publicId: string): Promise<DeviceView[]>
  registerDevice(publicId: string, fields: DeviceRegistrationFields): Promise<DeviceView>
  updateDevice(
    publicId: string,
    devicePublicId: string,
    fields: DeviceUpdateFields,
  ): Promise<DeviceView>
  removeDevice(publicId: string, devicePublicId: string): Promise<void>
  getDashboard(publicId: string): Promise<DashboardData>
}

export function createUsersService(repo: UserRepository, queue?: QueueClient): UsersService {
  return {
    async getProfile(publicId) {
      const result = await repo.findUserWithProfile(publicId)
      if (!result) throw new UserNotFoundError()
      return toProfileView(result.user, result.profile)
    },

    async updateProfile(publicId, fields) {
      const result = await repo.findUserWithProfile(publicId)
      if (!result) throw new UserNotFoundError()

      const userUpdates: Record<string, unknown> = {}
      if (fields.displayName !== undefined) userUpdates.name = fields.displayName
      if (fields.email !== undefined) userUpdates.email = fields.email
      if (fields.avatarObjectKey !== undefined) userUpdates.image = fields.avatarObjectKey

      if (Object.keys(userUpdates).length > 0) {
        await repo.updateUserById(publicId, userUpdates)
      }

      if (result.profile) {
        const profileUpdates: Record<string, unknown> = {}
        if (fields.educationSegment !== undefined)
          profileUpdates.educationSegment = fields.educationSegment
        if (fields.languagePreference !== undefined)
          profileUpdates.languagePreference = fields.languagePreference
        if (fields.timezone !== undefined) profileUpdates.timezone = fields.timezone
        if (fields.notificationPreferences !== undefined)
          profileUpdates.notificationPreferences = fields.notificationPreferences
        if (fields.examPreferences !== undefined)
          profileUpdates.examPreferences = fields.examPreferences

        if (Object.keys(profileUpdates).length > 0) {
          await repo.updateUserProfileByUserId(result.user.id, profileUpdates)
        }
      }

      const refreshed = await repo.findUserWithProfile(publicId)
      if (!refreshed) throw new UserNotFoundError()
      return toProfileView(refreshed.user, refreshed.profile)
    },

    async deleteAccount(publicId) {
      const result = await repo.findUserWithProfile(publicId)
      if (!result) throw new UserNotFoundError()

      const gracePeriodDays = 30
      const deletionScheduledAt = new Date()
      deletionScheduledAt.setDate(deletionScheduledAt.getDate() + gracePeriodDays)

      await repo.updateUserById(publicId, {
        deletionRequestedAt: deletionScheduledAt,
        deletedAt: deletionScheduledAt,
        accountStatus: 'deleted',
      })

      return { deletionScheduledAt: deletionScheduledAt.toISOString() }
    },

    async getOnboarding(publicId) {
      const result = await repo.findUserWithProfile(publicId)
      if (!result) throw new UserNotFoundError()

      return {
        isCompleted: result.profile?.isOnboardingCompleted ?? false,
        currentStep: result.profile?.onboardingStep ?? 0,
      }
    },

    async updateOnboarding(publicId, step) {
      const result = await repo.findUserWithProfile(publicId)
      if (!result) throw new UserNotFoundError()

      if (step === 5) {
        await repo.completeOnboarding(result.user.id)
        return { isCompleted: true, currentStep: step }
      }

      await repo.setOnboardingStep(result.user.id, step)
      return { isCompleted: false, currentStep: step }
    },

    async retriggerOnboarding(publicId) {
      const result = await repo.findUserWithProfile(publicId)
      if (!result) throw new UserNotFoundError()

      await repo.setOnboardingStep(result.user.id, 0)
      await repo.updateUserProfileByUserId(result.user.id, {
        isOnboardingCompleted: false,
      })
    },

    async getConsents(publicId) {
      const result = await repo.findUserWithProfile(publicId)
      if (!result) throw new UserNotFoundError()

      const rows = await repo.getConsents(result.user.id)
      return rows.map((r) => ({
        consentType: r.consentType!,
        consentVersion: r.consentVersion,
        isGranted: r.isGranted,
        consentedAt: r.consentedAt.toISOString(),
      }))
    },

    async updateConsents(publicId, consents) {
      const result = await repo.findUserWithProfile(publicId)
      if (!result) throw new UserNotFoundError()

      const nonEssential = consents.filter((c) => c.consentType !== 'essential')
      if (nonEssential.length === 0) return

      await repo.upsertConsents(result.user.id, nonEssential)
    },

    async exportData(publicId, options) {
      const result = await repo.findUserWithProfile(publicId)
      if (!result) throw new UserNotFoundError()

      const include = options.include ?? ['PROFILE', 'PROGRESS', 'PURCHASES', 'CONSENTS']
      const format = options.format ?? 'json'

      const exportData: Record<string, unknown> = {}

      if (include.includes('PROFILE')) {
        exportData.profile = toProfileView(result.user, result.profile)
      }

      if (include.includes('CONSENTS')) {
        const consentRows = await repo.getConsents(result.user.id)
        exportData.consents = consentRows.map((r) => ({
          consentType: r.consentType,
          consentVersion: r.consentVersion,
          isGranted: r.isGranted,
          consentedAt: r.consentedAt.toISOString(),
        }))
      }

      if (include.includes('PROGRESS') || include.includes('PURCHASES')) {
        // Enqueue background job for heavy data assembly
        if (queue) {
          await queue.enqueue(JobType.DATA_EXPORT, {
            userId: publicId,
            format: format as 'json' | 'csv',
            requestedAt: new Date().toISOString(),
            idempotencyKey: `export-${publicId}-${Date.now()}`,
          })
        }
      }

      return {
        ...exportData,
        _meta: {
          format,
          exportedAt: new Date().toISOString(),
          requestedCategories: include,
        },
      }
    },

    async getDevices(publicId) {
      const result = await repo.findUserWithProfile(publicId)
      if (!result) throw new UserNotFoundError()

      const rows = await repo.getDevices(result.user.id)
      return rows.map(toDeviceView)
    },

    async registerDevice(publicId, fields) {
      const result = await repo.findUserWithProfile(publicId)
      if (!result) throw new UserNotFoundError()

      const count = await repo.getDeviceCount(result.user.id)
      const max = await repo.getMaxDevices(result.user.id)
      if (count >= max) throw new DeviceLimitExceededError(max)

      const device = await repo.createDevice(result.user.id, fields)
      return toDeviceView(device)
    },

    async updateDevice(publicId, devicePublicId, fields) {
      const result = await repo.findUserWithProfile(publicId)
      if (!result) throw new UserNotFoundError()

      const existing = await repo.findDeviceByPublicId(result.user.id, devicePublicId)
      if (!existing) throw new DeviceNotFoundError()

      const device = await repo.updateDevice(result.user.id, devicePublicId, fields)
      if (!device) throw new DeviceNotFoundError()
      return toDeviceView(device)
    },

    async removeDevice(publicId, devicePublicId) {
      const result = await repo.findUserWithProfile(publicId)
      if (!result) throw new UserNotFoundError()

      const existing = await repo.findDeviceByPublicId(result.user.id, devicePublicId)
      if (!existing) throw new DeviceNotFoundError()

      await repo.deleteDevice(result.user.id, devicePublicId)
    },

    async getDashboard(publicId) {
      const result = await repo.findUserWithProfile(publicId)
      if (!result) throw new UserNotFoundError()

      // Dashboard is a composite view — return placeholder structure.
      // Real aggregation will query enrollments, completions, etc.
      return {
        userStats: {
          minutesToday: 0,
          lessonsToday: 0,
          xpEarned: 0,
          streakDays: 0,
          streakTarget: 7,
        },
        recentActivity: [],
        insights: [],
        weeklyData: {
          barHeights: [],
          dayTotals: [],
          sessions: {},
        },
        deadlines: [],
        jumpBack: {
          title: '',
          progress: 0,
          imageSeed: '',
        },
      }
    },
  }
}

// ── Mappers ────────────────────────────────────────────────────────────────

function toProfileView(
  user: {
    id: string
    name: string | null
    email: string | null
    image: string | null
    accountStatus: string
    createdAt: Date
  },
  profile: {
    educationSegment: string | null
    notificationPreferences: unknown
    languagePreference: string
    timezone: string
    examPreferences: unknown
    isOnboardingCompleted: boolean
    onboardingStep: number
  } | null,
): UserProfileView {
  return {
    id: user.id,
    displayName: user.name,
    email: user.email ?? '',
    avatarUrl: user.image,
    educationSegment: profile?.educationSegment ?? null,
    notificationPreferences: (profile?.notificationPreferences as Record<string, unknown>) ?? {},
    languagePreference: profile?.languagePreference ?? 'en',
    timezone: profile?.timezone ?? 'Africa/Addis_Ababa',
    examPreferences: (profile?.examPreferences as unknown[]) ?? [],
    isOnboardingCompleted: profile?.isOnboardingCompleted ?? false,
    onboardingStep: profile?.onboardingStep ?? 0,
    accountStatus: user.accountStatus,
    createdAt: user.createdAt.toISOString(),
  }
}

function toDeviceView(device: typeof devices.$inferSelect): DeviceView {
  return {
    id: device.publicId,
    deviceIdentifier: device.deviceIdentifier,
    deviceName: device.deviceName,
    platform: device.platform,
    osVersion: device.osVersion,
    appVersion: device.appVersion,
    lastActiveAt: device.lastActiveAt.toISOString(),
    isActive: device.isActive,
  }
}
