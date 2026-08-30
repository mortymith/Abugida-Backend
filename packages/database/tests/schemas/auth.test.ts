import { describe, it, expect } from 'bun:test'
import {
  insertUserSchema,
  selectUserSchema,
  accountStatusEnum,
  insertUserProfileSchema,
  selectUserProfileSchema,
  educationSegmentEnum,
  insertDeviceSchema,
  selectDeviceSchema,
  devicePlatformEnum,
  insertUserConsentSchema,
  selectUserConsentSchema,
  consentTypeEnum,
  insertLoginAttemptSchema,
  selectLoginAttemptSchema,
  loginAttemptTypeEnum,
  insertSessionSchema,
  selectSessionSchema,
  insertAccountSchema,
  selectAccountSchema,
  insertVerificationSchema,
  selectVerificationSchema,
} from '../../schema/auth'

describe('auth schemas', () => {
  describe('users', () => {
    const validUser = {
      accountStatus: 'active' as const,
      phoneNumberHash: 'abc123def456',
      phoneNumberLast4: '1234',
      displayName: 'Test User',
      maxDevices: 3,
      deviceCount: 0,
      failedLoginAttempts: 0,
    }

    it('accepts valid user insert', () => {
      const result = insertUserSchema.safeParse(validUser)
      expect(result.success).toBe(true)
    })

    it('accepts minimal user insert', () => {
      const result = insertUserSchema.safeParse({ accountStatus: 'active' })
      expect(result.success).toBe(true)
    })

    it('strips publicId from insert', () => {
      const result = insertUserSchema.safeParse({ ...validUser, publicId: 'test' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.publicId).toBeUndefined()
      }
    })

    it('validates displayName max length', () => {
      const result = insertUserSchema.safeParse({
        ...validUser,
        displayName: 'x'.repeat(101),
      })
      expect(result.success).toBe(false)
    })

    it('validates phoneNumberHash max length', () => {
      const result = insertUserSchema.safeParse({
        ...validUser,
        phoneNumberHash: 'x'.repeat(65),
      })
      expect(result.success).toBe(false)
    })

    it('validates phoneNumberLast4 length', () => {
      const result = insertUserSchema.safeParse({
        ...validUser,
        phoneNumberLast4: '12',
      })
      expect(result.success).toBe(false)
    })

    it('validates maxDevices range', () => {
      expect(insertUserSchema.safeParse({ ...validUser, maxDevices: 0 }).success).toBe(false)
      expect(insertUserSchema.safeParse({ ...validUser, maxDevices: 11 }).success).toBe(false)
      expect(insertUserSchema.safeParse({ ...validUser, maxDevices: 5 }).success).toBe(true)
    })

    it('validates deviceCount min', () => {
      expect(insertUserSchema.safeParse({ ...validUser, deviceCount: -1 }).success).toBe(false)
    })

    it('validates failedLoginAttempts min', () => {
      expect(insertUserSchema.safeParse({ ...validUser, failedLoginAttempts: -1 }).success).toBe(
        false,
      )
    })

    it('accepts select schema', () => {
      const result = selectUserSchema.safeParse({
        id: 1,
        publicId: '550e8400-e29b-41d4-a716-446655440000',
        phoneNumberEncrypted: null,
        phoneNumberHash: null,
        phoneNumberLast4: null,
        hashVersion: null,
        deviceCount: 0,
        maxDevices: 3,
        displayName: null,
        betterAuthId: null,
        email: null,
        emailVerified: false,
        image: null,
        accountStatus: 'active',
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
        lastActiveAt: null,
        deletionRequestedAt: null,
        deletionCompletedAt: null,
        retentionExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('user profiles', () => {
    const validProfile = {
      userId: 1,
      languagePreference: 'am',
      timezone: 'Africa/Addis_Ababa',
      onboardingStep: 2,
      isOnboardingCompleted: false,
    }

    it('accepts valid profile insert', () => {
      const result = insertUserProfileSchema.safeParse(validProfile)
      expect(result.success).toBe(true)
    })

    it('validates onboardingStep range', () => {
      expect(
        insertUserProfileSchema.safeParse({
          ...validProfile,
          onboardingStep: -1,
        }).success,
      ).toBe(false)
      expect(
        insertUserProfileSchema.safeParse({
          ...validProfile,
          onboardingStep: 6,
        }).success,
      ).toBe(false)
      expect(
        insertUserProfileSchema.safeParse({
          ...validProfile,
          onboardingStep: 3,
        }).success,
      ).toBe(true)
    })

    it('validates languagePreference length', () => {
      expect(
        insertUserProfileSchema.safeParse({
          ...validProfile,
          languagePreference: 'a',
        }).success,
      ).toBe(false)
      expect(
        insertUserProfileSchema.safeParse({
          ...validProfile,
          languagePreference: 'en',
        }).success,
      ).toBe(true)
    })

    it('validates timezone length', () => {
      expect(
        insertUserProfileSchema.safeParse({
          ...validProfile,
          timezone: '',
        }).success,
      ).toBe(false)
    })
  })

  describe('devices', () => {
    const validDevice = {
      userId: 1,
      deviceIdentifier: 'device-123',
      deviceName: 'iPhone 15',
      platform: 'ios' as const,
      isActive: true,
    }

    it('accepts valid device insert', () => {
      const result = insertDeviceSchema.safeParse(validDevice)
      expect(result.success).toBe(true)
    })

    it('requires deviceIdentifier', () => {
      const result = insertDeviceSchema.safeParse({
        userId: 1,
        platform: 'ios',
      })
      expect(result.success).toBe(false)
    })

    it('validates deviceIdentifier min length', () => {
      const result = insertDeviceSchema.safeParse({
        userId: 1,
        deviceIdentifier: '',
        platform: 'ios',
      })
      expect(result.success).toBe(false)
    })

    it('validates deviceIdentifier max length', () => {
      const result = insertDeviceSchema.safeParse({
        userId: 1,
        deviceIdentifier: 'x'.repeat(256),
        platform: 'ios',
      })
      expect(result.success).toBe(false)
    })

    it('validates deviceName max length', () => {
      const result = insertDeviceSchema.safeParse({
        userId: 1,
        deviceIdentifier: 'test',
        deviceName: 'x'.repeat(101),
        platform: 'ios',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('user consents', () => {
    const validConsent = {
      userId: 1,
      consentType: 'analytics' as const,
      consentVersion: '1.0',
      isGranted: true,
    }

    it('accepts valid consent insert', () => {
      const result = insertUserConsentSchema.safeParse(validConsent)
      expect(result.success).toBe(true)
    })

    it('requires consentVersion', () => {
      const result = insertUserConsentSchema.safeParse({
        userId: 1,
        consentType: 'analytics',
        isGranted: true,
      })
      expect(result.success).toBe(false)
    })

    it('validates consentVersion length', () => {
      const result = insertUserConsentSchema.safeParse({
        userId: 1,
        consentType: 'analytics',
        consentVersion: 'x'.repeat(21),
        isGranted: true,
      })
      expect(result.success).toBe(false)
    })

    it('accepts all consent types', () => {
      for (const type of consentTypeEnum.options) {
        const result = insertUserConsentSchema.safeParse({
          userId: 1,
          consentType: type,
          consentVersion: '1.0',
          isGranted: true,
        })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('login attempts', () => {
    const validAttempt = {
      phoneNumberLast4: '5678',
      ipAddress: '192.168.1.1',
      attemptType: 'oauth_login' as const,
      isSuccessful: true,
      retentionExpiresAt: new Date('2026-12-31'),
    }

    it('accepts valid login attempt insert', () => {
      const result = insertLoginAttemptSchema.safeParse(validAttempt)
      expect(result.success).toBe(true)
    })

    it('requires phoneNumberLast4', () => {
      const result = insertLoginAttemptSchema.safeParse({
        ipAddress: '192.168.1.1',
        attemptType: 'oauth_login',
        isSuccessful: true,
        retentionExpiresAt: new Date(),
      })
      expect(result.success).toBe(false)
    })

    it('validates phoneNumberLast4 length', () => {
      const result = insertLoginAttemptSchema.safeParse({
        ...validAttempt,
        phoneNumberLast4: '12',
      })
      expect(result.success).toBe(false)
    })

    it('requires ipAddress', () => {
      const result = insertLoginAttemptSchema.safeParse({
        phoneNumberLast4: '1234',
        attemptType: 'oauth_login',
        isSuccessful: true,
        retentionExpiresAt: new Date(),
      })
      expect(result.success).toBe(false)
    })

    it('validates userAgent max length', () => {
      const result = insertLoginAttemptSchema.safeParse({
        ...validAttempt,
        userAgent: 'x'.repeat(501),
      })
      expect(result.success).toBe(false)
    })

    it('accepts all login attempt types', () => {
      for (const type of loginAttemptTypeEnum.options) {
        const result = insertLoginAttemptSchema.safeParse({
          ...validAttempt,
          attemptType: type,
        })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('session', () => {
    const validSession = {
      id: 'sess_abc123',
      userId: 'user_xyz789',
      token: 'tok_abc123def456',
      expiresAt: new Date('2026-12-31'),
    }

    it('accepts valid session insert', () => {
      const result = insertSessionSchema.safeParse(validSession)
      expect(result.success).toBe(true)
    })

    it('requires id', () => {
      const result = insertSessionSchema.safeParse({
        userId: 'user_xyz789',
        token: 'tok_abc123',
        expiresAt: new Date(),
      })
      expect(result.success).toBe(false)
    })

    it('requires userId', () => {
      const result = insertSessionSchema.safeParse({
        id: 'sess_abc123',
        token: 'tok_abc123',
        expiresAt: new Date(),
      })
      expect(result.success).toBe(false)
    })

    it('requires token', () => {
      const result = insertSessionSchema.safeParse({
        id: 'sess_abc123',
        userId: 'user_xyz789',
        expiresAt: new Date(),
      })
      expect(result.success).toBe(false)
    })

    it('requires expiresAt', () => {
      const result = insertSessionSchema.safeParse({
        id: 'sess_abc123',
        userId: 'user_xyz789',
        token: 'tok_abc123',
      })
      expect(result.success).toBe(false)
    })

    it('accepts optional fields', () => {
      const result = insertSessionSchema.safeParse({
        ...validSession,
        refreshToken: 'ref_abc123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      })
      expect(result.success).toBe(true)
    })

    it('accepts select schema', () => {
      const result = selectSessionSchema.safeParse({
        id: 'sess_abc123',
        userId: 'user_xyz789',
        token: 'tok_abc123',
        refreshToken: null,
        expiresAt: new Date(),
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
      })
      expect(result.success).toBe(true)
    })
  })

  describe('account', () => {
    const validAccount = {
      id: 'acc_abc123',
      userId: 'user_xyz789',
      providerId: 'google',
      accountId: 'google_123456',
    }

    it('accepts valid account insert', () => {
      const result = insertAccountSchema.safeParse(validAccount)
      expect(result.success).toBe(true)
    })

    it('requires id', () => {
      const result = insertAccountSchema.safeParse({
        userId: 'user_xyz789',
        providerId: 'google',
        accountId: 'google_123456',
      })
      expect(result.success).toBe(false)
    })

    it('requires userId', () => {
      const result = insertAccountSchema.safeParse({
        id: 'acc_abc123',
        providerId: 'google',
        accountId: 'google_123456',
      })
      expect(result.success).toBe(false)
    })

    it('requires providerId', () => {
      const result = insertAccountSchema.safeParse({
        id: 'acc_abc123',
        userId: 'user_xyz789',
        accountId: 'google_123456',
      })
      expect(result.success).toBe(false)
    })

    it('requires accountId', () => {
      const result = insertAccountSchema.safeParse({
        id: 'acc_abc123',
        userId: 'user_xyz789',
        providerId: 'google',
      })
      expect(result.success).toBe(false)
    })

    it('accepts optional OAuth fields', () => {
      const result = insertAccountSchema.safeParse({
        ...validAccount,
        accessToken: 'ya29.access_token',
        refreshToken: '1//-refresh_token',
        accessTokenExpiresAt: new Date('2026-01-01'),
        idToken: 'eyJhbGciOiJSUzI1NiJ9',
      })
      expect(result.success).toBe(true)
    })

    it('accepts select schema', () => {
      const result = selectAccountSchema.safeParse({
        id: 'acc_abc123',
        userId: 'user_xyz789',
        providerId: 'google',
        accountId: 'google_123456',
        accessToken: null,
        refreshToken: null,
        accessTokenExpiresAt: null,
        idToken: null,
        createdAt: new Date(),
      })
      expect(result.success).toBe(true)
    })
  })

  describe('verification', () => {
    const validVerification = {
      id: 'ver_abc123',
      identifier: 'user@example.com',
      value: '123456',
      expiresAt: new Date('2026-12-31'),
    }

    it('accepts valid verification insert', () => {
      const result = insertVerificationSchema.safeParse(validVerification)
      expect(result.success).toBe(true)
    })

    it('requires id', () => {
      const result = insertVerificationSchema.safeParse({
        identifier: 'user@example.com',
        value: '123456',
        expiresAt: new Date(),
      })
      expect(result.success).toBe(false)
    })

    it('requires identifier', () => {
      const result = insertVerificationSchema.safeParse({
        id: 'ver_abc123',
        value: '123456',
        expiresAt: new Date(),
      })
      expect(result.success).toBe(false)
    })

    it('requires value', () => {
      const result = insertVerificationSchema.safeParse({
        id: 'ver_abc123',
        identifier: 'user@example.com',
        expiresAt: new Date(),
      })
      expect(result.success).toBe(false)
    })

    it('requires expiresAt', () => {
      const result = insertVerificationSchema.safeParse({
        id: 'ver_abc123',
        identifier: 'user@example.com',
        value: '123456',
      })
      expect(result.success).toBe(false)
    })

    it('accepts select schema', () => {
      const result = selectVerificationSchema.safeParse({
        id: 'ver_abc123',
        identifier: 'user@example.com',
        value: '123456',
        expiresAt: new Date(),
      })
      expect(result.success).toBe(true)
    })
  })
})
