import { describe, it, expect } from 'bun:test'
import {
  accountStatusEnum,
  educationSegmentEnum,
  devicePlatformEnum,
  consentTypeEnum,
  loginAttemptTypeEnum,
  courseStatusEnum,
  bundleStatusEnum,
  contentTypeEnum,
  purchaseStatusEnum,
  transactionTypeEnum,
  transactionStatusEnum,
  contentLicenseTypeEnum,
  contentLicenseStatusEnum,
  licenseGrantStatusEnum,
  paymentProviderEnum,
  platformEnum,
  enrollmentSourceEnum,
  moderationStatusEnum,
  auditActionEnum,
  auditResourceTypeEnum,
  securityEventTypeEnum,
  severityLevelEnum,
  outboxEventStatusEnum,
  webhookEventStatusEnum,
  principalTypeEnum,
} from '../schema'

describe('pgEnum definitions', () => {
  describe('auth enums', () => {
    it('accountStatusEnum has correct values', () => {
      expect(accountStatusEnum.options).toEqual([
        'pending_verification',
        'active',
        'locked',
        'suspended',
        'deleted',
      ])
    })

    it('educationSegmentEnum has correct values', () => {
      expect(educationSegmentEnum.options).toEqual(['toefl', 'igcse', 'high_school', 'college'])
    })

    it('devicePlatformEnum has correct values', () => {
      expect(devicePlatformEnum.options).toEqual(['ios', 'android', 'web'])
    })

    it('consentTypeEnum has correct values', () => {
      expect(consentTypeEnum.options).toEqual([
        'essential',
        'analytics',
        'personalization',
        'marketing',
        'third_party_sharing',
      ])
    })

    it('loginAttemptTypeEnum has correct values', () => {
      expect(loginAttemptTypeEnum.options).toEqual(['oauth_login', 'token_refresh'])
    })
  })

  describe('catalog enums', () => {
    it('courseStatusEnum has correct values', () => {
      expect(courseStatusEnum.options).toEqual(['draft', 'published', 'archived'])
    })

    it('bundleStatusEnum has correct values', () => {
      expect(bundleStatusEnum.options).toEqual(['draft', 'published', 'archived'])
    })

    it('contentTypeEnum has correct values', () => {
      expect(contentTypeEnum.options).toEqual(['pdf', 'video', 'quiz', 'exercise', 'link'])
    })
  })

  describe('finance enums', () => {
    it('purchaseStatusEnum has correct values', () => {
      expect(purchaseStatusEnum.options).toEqual([
        'initiated',
        'payment_pending',
        'completed',
        'failed',
      ])
    })

    it('transactionTypeEnum has correct values', () => {
      expect(transactionTypeEnum.options).toEqual(['authorization', 'capture'])
    })

    it('transactionStatusEnum has correct values', () => {
      expect(transactionStatusEnum.options).toEqual(['pending', 'succeeded', 'failed'])
    })

    it('contentLicenseTypeEnum has correct values', () => {
      expect(contentLicenseTypeEnum.options).toEqual([
        'perpetual',
        'subscription',
        'limited_use',
        'open_source',
      ])
    })

    it('contentLicenseStatusEnum has correct values', () => {
      expect(contentLicenseStatusEnum.options).toEqual([
        'active',
        'expiring_soon',
        'expired',
        'revoked',
      ])
    })

    it('licenseGrantStatusEnum has correct values', () => {
      expect(licenseGrantStatusEnum.options).toEqual(['active', 'expired', 'revoked'])
    })

    it('paymentProviderEnum has correct values', () => {
      expect(paymentProviderEnum.options).toEqual(['telebirr'])
    })

    it('platformEnum has correct values', () => {
      expect(platformEnum.options).toEqual(['ios', 'android', 'web'])
    })
  })

  describe('learning enums', () => {
    it('enrollmentSourceEnum has correct values', () => {
      expect(enrollmentSourceEnum.options).toEqual([
        'purchase',
        'bundle_purchase',
        'free_access',
        'admin_grant',
        'preview',
      ])
    })

    it('moderationStatusEnum has correct values', () => {
      expect(moderationStatusEnum.options).toEqual(['pending', 'approved', 'rejected', 'edited'])
    })
  })

  describe('ops enums', () => {
    it('auditActionEnum has correct values', () => {
      expect(auditActionEnum.options).toEqual([
        'user_login',
        'user_logout',
        'purchase_completed',
        'lesson_access',
        'admin_action',
        'data_export',
        'permission_change',
        'content_moderation',
        'grade_modified',
        'enrollment_status_changed',
        'bundle_purchased',
      ])
    })

    it('auditResourceTypeEnum has correct values', () => {
      expect(auditResourceTypeEnum.options).toEqual([
        'course',
        'module',
        'lesson',
        'enrollment',
        'quiz_attempt',
        'purchase',
        'user_account',
        'role_assignment',
        'bundle',
      ])
    })

    it('securityEventTypeEnum has correct values', () => {
      expect(securityEventTypeEnum.options).toEqual([
        'failed_login',
        'account_lockout',
        'suspicious_ip',
        'token_reuse',
        'rate_limit_exceeded',
        'permission_denied',
      ])
    })

    it('severityLevelEnum has correct values', () => {
      expect(severityLevelEnum.options).toEqual(['info', 'warning', 'critical'])
    })

    it('outboxEventStatusEnum has correct values', () => {
      expect(outboxEventStatusEnum.options).toEqual([
        'pending',
        'processing',
        'completed',
        'failed',
      ])
    })

    it('webhookEventStatusEnum has correct values', () => {
      expect(webhookEventStatusEnum.options).toEqual(['pending', 'sent', 'failed', 'retrying'])
    })

    it('principalTypeEnum has correct values', () => {
      expect(principalTypeEnum.options).toEqual(['user', 'service_account', 'system'])
    })
  })

  describe('enum validation', () => {
    it('rejects invalid enum values', () => {
      expect(accountStatusEnum.safeParse('invalid').success).toBe(false)
      expect(courseStatusEnum.safeParse('active').success).toBe(false)
      expect(contentTypeEnum.safeParse('audio').success).toBe(false)
      expect(purchaseStatusEnum.safeParse('refunded').success).toBe(false)
    })

    it('accepts valid enum values', () => {
      expect(accountStatusEnum.safeParse('active').success).toBe(true)
      expect(courseStatusEnum.safeParse('published').success).toBe(true)
      expect(contentTypeEnum.safeParse('video').success).toBe(true)
      expect(purchaseStatusEnum.safeParse('completed').success).toBe(true)
    })
  })

  describe('enum safeParse — auth', () => {
    const enums = [
      { name: 'accountStatusEnum', enum: accountStatusEnum, valid: 'active', invalid: 'banned' },
      { name: 'educationSegmentEnum', enum: educationSegmentEnum, valid: 'toefl', invalid: 'sat' },
      { name: 'devicePlatformEnum', enum: devicePlatformEnum, valid: 'ios', invalid: 'windows' },
      { name: 'consentTypeEnum', enum: consentTypeEnum, valid: 'essential', invalid: 'unknown' },
      {
        name: 'loginAttemptTypeEnum',
        enum: loginAttemptTypeEnum,
        valid: 'oauth_login',
        invalid: 'password_login',
      },
    ]

    for (const { name, enum: e, valid, invalid } of enums) {
      it(`${name} accepts "${valid}" and rejects "${invalid}"`, () => {
        expect(e.safeParse(valid).success).toBe(true)
        expect(e.safeParse(invalid).success).toBe(false)
      })
    }
  })

  describe('enum safeParse — catalog', () => {
    const enums = [
      { name: 'courseStatusEnum', enum: courseStatusEnum, valid: 'draft', invalid: 'deleted' },
      { name: 'bundleStatusEnum', enum: bundleStatusEnum, valid: 'archived', invalid: 'hidden' },
      { name: 'contentTypeEnum', enum: contentTypeEnum, valid: 'exercise', invalid: 'audio' },
    ]

    for (const { name, enum: e, valid, invalid } of enums) {
      it(`${name} accepts "${valid}" and rejects "${invalid}"`, () => {
        expect(e.safeParse(valid).success).toBe(true)
        expect(e.safeParse(invalid).success).toBe(false)
      })
    }
  })

  describe('enum safeParse — finance', () => {
    const enums = [
      {
        name: 'purchaseStatusEnum',
        enum: purchaseStatusEnum,
        valid: 'initiated',
        invalid: 'refunded',
      },
      {
        name: 'transactionTypeEnum',
        enum: transactionTypeEnum,
        valid: 'authorization',
        invalid: 'refund',
      },
      {
        name: 'transactionStatusEnum',
        enum: transactionStatusEnum,
        valid: 'succeeded',
        invalid: 'cancelled',
      },
      {
        name: 'contentLicenseTypeEnum',
        enum: contentLicenseTypeEnum,
        valid: 'perpetual',
        invalid: 'trial',
      },
      {
        name: 'contentLicenseStatusEnum',
        enum: contentLicenseStatusEnum,
        valid: 'expiring_soon',
        invalid: 'suspended',
      },
      {
        name: 'licenseGrantStatusEnum',
        enum: licenseGrantStatusEnum,
        valid: 'expired',
        invalid: 'pending',
      },
      {
        name: 'paymentProviderEnum',
        enum: paymentProviderEnum,
        valid: 'telebirr',
        invalid: 'stripe',
      },
      { name: 'platformEnum', enum: platformEnum, valid: 'android', invalid: 'desktop' },
    ]

    for (const { name, enum: e, valid, invalid } of enums) {
      it(`${name} accepts "${valid}" and rejects "${invalid}"`, () => {
        expect(e.safeParse(valid).success).toBe(true)
        expect(e.safeParse(invalid).success).toBe(false)
      })
    }
  })

  describe('enum safeParse — learning', () => {
    const enums = [
      {
        name: 'enrollmentSourceEnum',
        enum: enrollmentSourceEnum,
        valid: 'free_access',
        invalid: 'invitation',
      },
      {
        name: 'moderationStatusEnum',
        enum: moderationStatusEnum,
        valid: 'approved',
        invalid: 'flagged',
      },
    ]

    for (const { name, enum: e, valid, invalid } of enums) {
      it(`${name} accepts "${valid}" and rejects "${invalid}"`, () => {
        expect(e.safeParse(valid).success).toBe(true)
        expect(e.safeParse(invalid).success).toBe(false)
      })
    }
  })

  describe('enum safeParse — ops', () => {
    const enums = [
      {
        name: 'auditActionEnum',
        enum: auditActionEnum,
        valid: 'user_login',
        invalid: 'user_register',
      },
      {
        name: 'auditResourceTypeEnum',
        enum: auditResourceTypeEnum,
        valid: 'course',
        invalid: 'module_item',
      },
      {
        name: 'securityEventTypeEnum',
        enum: securityEventTypeEnum,
        valid: 'failed_login',
        invalid: 'brute_force',
      },
      { name: 'severityLevelEnum', enum: severityLevelEnum, valid: 'critical', invalid: 'fatal' },
      {
        name: 'outboxEventStatusEnum',
        enum: outboxEventStatusEnum,
        valid: 'processing',
        invalid: 'cancelled',
      },
      {
        name: 'webhookEventStatusEnum',
        enum: webhookEventStatusEnum,
        valid: 'retrying',
        invalid: 'timeout',
      },
      {
        name: 'principalTypeEnum',
        enum: principalTypeEnum,
        valid: 'service_account',
        invalid: 'api_key',
      },
    ]

    for (const { name, enum: e, valid, invalid } of enums) {
      it(`${name} accepts "${valid}" and rejects "${invalid}"`, () => {
        expect(e.safeParse(valid).success).toBe(true)
        expect(e.safeParse(invalid).success).toBe(false)
      })
    }
  })
})
