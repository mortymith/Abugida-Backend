import { describe, it, expect } from 'bun:test'
import { updateUserSchema, updateUserProfileSchema, updateDeviceSchema } from '../../schema/auth'
import {
  updateCourseSchema,
  updateModuleSchema,
  updateLessonSchema,
  updateBundleSchema,
} from '../../schema/catalog'
import { updatePurchaseSchema, updatePaymentGatewaySchema } from '../../schema/finance'
import {
  updateEnrollmentSchema,
  updateCourseReviewSchema,
  updateQuizAttemptSchema,
} from '../../schema/learning'
import {
  updateRoleSchema,
  updateFeatureFlagSchema,
  updateOutboxEventSchema,
  updateApiKeySchema,
} from '../../schema/ops'
import { updateFileMetadataSchema } from '../../schema/shared'

describe('update schemas', () => {
  describe('auth', () => {
    it('accepts empty update (all fields optional)', () => {
      const result = updateUserSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('accepts partial user update', () => {
      const result = updateUserSchema.safeParse({ displayName: 'New Name' })
      expect(result.success).toBe(true)
    })

    it('accepts accountStatus update', () => {
      const result = updateUserSchema.safeParse({ accountStatus: 'active' })
      expect(result.success).toBe(true)
    })

    it('rejects invalid accountStatus', () => {
      const result = updateUserSchema.safeParse({ accountStatus: 'invalid' })
      expect(result.success).toBe(false)
    })

    it('accepts user profile update', () => {
      const result = updateUserProfileSchema.safeParse({ onboardingStep: 3 })
      expect(result.success).toBe(true)
    })

    it('rejects out-of-range onboardingStep', () => {
      const result = updateUserProfileSchema.safeParse({ onboardingStep: 10 })
      expect(result.success).toBe(false)
    })

    it('accepts device update', () => {
      const result = updateDeviceSchema.safeParse({ deviceName: 'iPhone 15' })
      expect(result.success).toBe(true)
    })

    it('rejects deviceName too long', () => {
      const result = updateDeviceSchema.safeParse({ deviceName: 'x'.repeat(101) })
      expect(result.success).toBe(false)
    })
  })

  describe('catalog', () => {
    it('accepts empty course update', () => {
      const result = updateCourseSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('accepts course title update', () => {
      const result = updateCourseSchema.safeParse({ title: 'Updated Course' })
      expect(result.success).toBe(true)
    })

    it('rejects course title too long', () => {
      const result = updateCourseSchema.safeParse({ title: 'x'.repeat(301) })
      expect(result.success).toBe(false)
    })

    it('accepts course status update', () => {
      const result = updateCourseSchema.safeParse({ status: 'published' })
      expect(result.success).toBe(true)
    })

    it('rejects invalid course status', () => {
      const result = updateCourseSchema.safeParse({ status: 'invalid' })
      expect(result.success).toBe(false)
    })

    it('accepts module update', () => {
      const result = updateModuleSchema.safeParse({ title: 'Updated Module' })
      expect(result.success).toBe(true)
    })

    it('accepts lesson update', () => {
      const result = updateLessonSchema.safeParse({ title: 'Updated Lesson' })
      expect(result.success).toBe(true)
    })

    it('accepts bundle update', () => {
      const result = updateBundleSchema.safeParse({ discountPercentage: 25 })
      expect(result.success).toBe(true)
    })

    it('rejects discountPercentage out of range', () => {
      const result = updateBundleSchema.safeParse({ discountPercentage: 101 })
      expect(result.success).toBe(false)
    })
  })

  describe('finance', () => {
    it('accepts empty purchase update', () => {
      const result = updatePurchaseSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('accepts purchase status update', () => {
      const result = updatePurchaseSchema.safeParse({ status: 'completed' })
      expect(result.success).toBe(true)
    })

    it('rejects invalid purchase status', () => {
      const result = updatePurchaseSchema.safeParse({ status: 'refunded' })
      expect(result.success).toBe(false)
    })

    it('accepts payment gateway update', () => {
      const result = updatePaymentGatewaySchema.safeParse({ displayName: 'New Gateway' })
      expect(result.success).toBe(true)
    })
  })

  describe('learning', () => {
    it('accepts empty enrollment update', () => {
      const result = updateEnrollmentSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('accepts progress update', () => {
      const result = updateEnrollmentSchema.safeParse({ progressPercentage: 75.5 })
      expect(result.success).toBe(true)
    })

    it('rejects progress out of range', () => {
      const result = updateEnrollmentSchema.safeParse({ progressPercentage: 101 })
      expect(result.success).toBe(false)
    })

    it('accepts course review update', () => {
      const result = updateCourseReviewSchema.safeParse({ rating: 5 })
      expect(result.success).toBe(true)
    })

    it('rejects rating out of range', () => {
      const result = updateCourseReviewSchema.safeParse({ rating: 6 })
      expect(result.success).toBe(false)
    })

    it('accepts quiz attempt update', () => {
      const result = updateQuizAttemptSchema.safeParse({ quizScorePercentage: 85 })
      expect(result.success).toBe(true)
    })
  })

  describe('ops', () => {
    it('accepts empty role update', () => {
      const result = updateRoleSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('accepts role name update', () => {
      const result = updateRoleSchema.safeParse({ name: 'admin' })
      expect(result.success).toBe(true)
    })

    it('accepts feature flag update', () => {
      const result = updateFeatureFlagSchema.safeParse({ rolloutPercentage: 50 })
      expect(result.success).toBe(true)
    })

    it('rejects rolloutPercentage out of range', () => {
      const result = updateFeatureFlagSchema.safeParse({ rolloutPercentage: 101 })
      expect(result.success).toBe(false)
    })

    it('accepts outbox event update', () => {
      const result = updateOutboxEventSchema.safeParse({ status: 'processing' })
      expect(result.success).toBe(true)
    })

    it('accepts API key update', () => {
      const result = updateApiKeySchema.safeParse({ name: 'New Key' })
      expect(result.success).toBe(true)
    })
  })

  describe('shared', () => {
    it('accepts empty file metadata update', () => {
      const result = updateFileMetadataSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('accepts file metadata update', () => {
      const result = updateFileMetadataSchema.safeParse({ mimeType: 'application/pdf' })
      expect(result.success).toBe(true)
    })
  })
})
