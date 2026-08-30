import { describe, it, expect } from 'bun:test'
import {
  insertRoleSchema,
  insertCourseRoleSchema,
  insertPrincipalSchema,
  insertAuditLogSchema,
  insertSecurityEventSchema,
  insertFeatureFlagSchema,
  insertSystemConfigSchema,
  insertOutboxEventSchema,
  insertWebhookEventSchema,
  insertApiKeySchema,
  insertPermissionsReferenceSchema,
  auditActionEnum,
  auditResourceTypeEnum,
  securityEventTypeEnum,
  severityLevelEnum,
  outboxEventStatusEnum,
  webhookEventStatusEnum,
  principalTypeEnum,
} from '../../schema/ops'

describe('ops schemas', () => {
  describe('roles', () => {
    const validRole = {
      name: 'admin',
      description: 'Administrator role',
      permissions: ['users:read', 'users:write'],
    }

    it('accepts valid role insert', () => {
      const result = insertRoleSchema.safeParse(validRole)
      expect(result.success).toBe(true)
    })

    it('validates name max length', () => {
      expect(insertRoleSchema.safeParse({ ...validRole, name: 'x'.repeat(51) }).success).toBe(false)
    })

    it('accepts empty permissions', () => {
      const result = insertRoleSchema.safeParse({
        name: 'viewer',
        permissions: [],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('course roles', () => {
    it('accepts valid course role insert', () => {
      const result = insertCourseRoleSchema.safeParse({
        userId: 1,
        roleId: 1,
        courseId: 1,
      })
      expect(result.success).toBe(true)
    })

    it('accepts global role (no courseId)', () => {
      const result = insertCourseRoleSchema.safeParse({
        userId: 1,
        roleId: 1,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('principals', () => {
    const validPrincipal = {
      principalType: 'user' as const,
      name: 'API Service',
      metadata: { env: 'production' },
      isActive: true,
    }

    it('accepts valid principal insert', () => {
      const result = insertPrincipalSchema.safeParse(validPrincipal)
      expect(result.success).toBe(true)
    })

    it('accepts all principal types', () => {
      for (const type of principalTypeEnum.options) {
        const result = insertPrincipalSchema.safeParse({
          ...validPrincipal,
          principalType: type,
        })
        expect(result.success).toBe(true)
      }
    })

    it('validates name max length', () => {
      expect(
        insertPrincipalSchema.safeParse({
          ...validPrincipal,
          name: 'x'.repeat(101),
        }).success,
      ).toBe(false)
    })
  })

  describe('audit logs', () => {
    const validLog = {
      action: 'user_login' as const,
      resourceType: 'user_account' as const,
      metadata: { ip: '192.168.1.1' },
    }

    it('accepts valid audit log insert', () => {
      const result = insertAuditLogSchema.safeParse(validLog)
      expect(result.success).toBe(true)
    })

    it('accepts all audit actions', () => {
      for (const action of auditActionEnum.options) {
        const result = insertAuditLogSchema.safeParse({ ...validLog, action })
        expect(result.success).toBe(true)
      }
    })

    it('accepts all resource types', () => {
      for (const resourceType of auditResourceTypeEnum.options) {
        const result = insertAuditLogSchema.safeParse({ ...validLog, resourceType })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('security events', () => {
    const validEvent = {
      eventType: 'failed_login' as const,
      severity: 'warning' as const,
      description: 'Multiple failed login attempts',
      metadata: { attempts: 5 },
    }

    it('accepts valid security event insert', () => {
      const result = insertSecurityEventSchema.safeParse(validEvent)
      expect(result.success).toBe(true)
    })

    it('accepts all event types', () => {
      for (const eventType of securityEventTypeEnum.options) {
        const result = insertSecurityEventSchema.safeParse({ ...validEvent, eventType })
        expect(result.success).toBe(true)
      }
    })

    it('accepts all severity levels', () => {
      for (const severity of severityLevelEnum.options) {
        const result = insertSecurityEventSchema.safeParse({ ...validEvent, severity })
        expect(result.success).toBe(true)
      }
    })

    it('requires description', () => {
      const result = insertSecurityEventSchema.safeParse({
        eventType: 'failed_login',
        severity: 'info',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('feature flags', () => {
    const validFlag = {
      key: 'new_checkout_flow',
      displayName: 'New Checkout Flow',
      description: 'Enable the new checkout flow',
      isEnabled: false,
      rolloutPercentage: 50,
      allowedUserIds: [1, 2, 3],
      deniedUserIds: [],
      metadata: {},
    }

    it('accepts valid feature flag insert', () => {
      const result = insertFeatureFlagSchema.safeParse(validFlag)
      expect(result.success).toBe(true)
    })

    it('validates key format', () => {
      expect(
        insertFeatureFlagSchema.safeParse({
          ...validFlag,
          key: 'Invalid Key',
        }).success,
      ).toBe(false)
      expect(
        insertFeatureFlagSchema.safeParse({
          ...validFlag,
          key: 'valid_key_123',
        }).success,
      ).toBe(true)
    })

    it('validates rolloutPercentage range', () => {
      expect(
        insertFeatureFlagSchema.safeParse({
          ...validFlag,
          rolloutPercentage: -1,
        }).success,
      ).toBe(false)
      expect(
        insertFeatureFlagSchema.safeParse({
          ...validFlag,
          rolloutPercentage: 101,
        }).success,
      ).toBe(false)
    })

    it('validates key max length', () => {
      expect(
        insertFeatureFlagSchema.safeParse({
          ...validFlag,
          key: 'x'.repeat(101),
        }).success,
      ).toBe(false)
    })
  })

  describe('system configs', () => {
    const validConfig = {
      key: 'app.maintenance_mode',
      value: { enabled: false },
      description: 'Maintenance mode toggle',
      isEncrypted: false,
      category: 'app',
    }

    it('accepts valid config insert', () => {
      const result = insertSystemConfigSchema.safeParse(validConfig)
      expect(result.success).toBe(true)
    })

    it('requires value', () => {
      const result = insertSystemConfigSchema.safeParse({
        key: 'test',
        description: 'Test',
      })
      expect(result.success).toBe(false)
    })

    it('validates key max length', () => {
      expect(
        insertSystemConfigSchema.safeParse({
          ...validConfig,
          key: 'x'.repeat(201),
        }).success,
      ).toBe(false)
    })

    it('validates category max length', () => {
      expect(
        insertSystemConfigSchema.safeParse({
          ...validConfig,
          category: 'x'.repeat(101),
        }).success,
      ).toBe(false)
    })
  })

  describe('outbox events', () => {
    const validEvent = {
      aggregateType: 'Purchase',
      aggregateId: '123',
      eventType: 'purchase.completed',
      payload: { amount: 500 },
      status: 'pending' as const,
      retryCount: 0,
      maxRetries: 3,
    }

    it('accepts valid outbox event insert', () => {
      const result = insertOutboxEventSchema.safeParse(validEvent)
      expect(result.success).toBe(true)
    })

    it('accepts all outbox statuses', () => {
      for (const status of outboxEventStatusEnum.options) {
        const result = insertOutboxEventSchema.safeParse({ ...validEvent, status })
        expect(result.success).toBe(true)
      }
    })

    it('validates retryCount min', () => {
      expect(
        insertOutboxEventSchema.safeParse({
          ...validEvent,
          retryCount: -1,
        }).success,
      ).toBe(false)
    })

    it('validates maxRetries range', () => {
      expect(
        insertOutboxEventSchema.safeParse({
          ...validEvent,
          maxRetries: -1,
        }).success,
      ).toBe(false)
      expect(
        insertOutboxEventSchema.safeParse({
          ...validEvent,
          maxRetries: 11,
        }).success,
      ).toBe(false)
    })
  })

  describe('webhook events', () => {
    const validEvent = {
      webhookUrl: 'https://example.com/webhook',
      eventType: 'purchase.completed',
      payload: { amount: 500 },
      status: 'pending' as const,
      retryCount: 0,
      maxRetries: 3,
    }

    it('accepts valid webhook event insert', () => {
      const result = insertWebhookEventSchema.safeParse(validEvent)
      expect(result.success).toBe(true)
    })

    it('validates webhookUrl format', () => {
      expect(
        insertWebhookEventSchema.safeParse({
          ...validEvent,
          webhookUrl: 'not-a-url',
        }).success,
      ).toBe(false)
    })

    it('accepts all webhook statuses', () => {
      for (const status of webhookEventStatusEnum.options) {
        const result = insertWebhookEventSchema.safeParse({ ...validEvent, status })
        expect(result.success).toBe(true)
      }
    })

    it('validates maxRetries range', () => {
      expect(
        insertWebhookEventSchema.safeParse({
          ...validEvent,
          maxRetries: -1,
        }).success,
      ).toBe(false)
      expect(
        insertWebhookEventSchema.safeParse({
          ...validEvent,
          maxRetries: 11,
        }).success,
      ).toBe(false)
    })
  })

  describe('api keys', () => {
    const validKey = {
      userId: 1,
      name: 'Production API Key',
      keyHash: 'abc123def456',
      keyPrefix: 'ak_',
      scopes: ['read', 'write'],
      rateLimit: 1000,
      isActive: true,
      metadata: {},
    }

    it('accepts valid api key insert', () => {
      const result = insertApiKeySchema.safeParse(validKey)
      expect(result.success).toBe(true)
    })

    it('validates name max length', () => {
      expect(
        insertApiKeySchema.safeParse({
          ...validKey,
          name: 'x'.repeat(101),
        }).success,
      ).toBe(false)
    })

    it('validates keyHash max length', () => {
      expect(
        insertApiKeySchema.safeParse({
          ...validKey,
          keyHash: 'x'.repeat(256),
        }).success,
      ).toBe(false)
    })

    it('validates keyPrefix max length', () => {
      expect(
        insertApiKeySchema.safeParse({
          ...validKey,
          keyPrefix: 'x'.repeat(21),
        }).success,
      ).toBe(false)
    })

    it('validates rateLimit min', () => {
      expect(
        insertApiKeySchema.safeParse({
          ...validKey,
          rateLimit: 0,
        }).success,
      ).toBe(false)
    })
  })

  describe('permissions reference', () => {
    it('accepts valid permissions reference insert', () => {
      const result = insertPermissionsReferenceSchema.safeParse({
        resource: 'course',
        action: 'read',
        displayName: 'Read Course',
        isActive: true,
      })
      expect(result.success).toBe(true)
    })

    it('validates resource max length', () => {
      const result = insertPermissionsReferenceSchema.safeParse({
        resource: 'x'.repeat(101),
        action: 'read',
        displayName: 'Read',
      })
      expect(result.success).toBe(false)
    })

    it('validates action max length', () => {
      const result = insertPermissionsReferenceSchema.safeParse({
        resource: 'course',
        action: 'x'.repeat(51),
        displayName: 'Read',
      })
      expect(result.success).toBe(false)
    })

    it('validates displayName max length', () => {
      const result = insertPermissionsReferenceSchema.safeParse({
        resource: 'course',
        action: 'read',
        displayName: 'x'.repeat(151),
      })
      expect(result.success).toBe(false)
    })
  })
})
