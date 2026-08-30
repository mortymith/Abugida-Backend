import { describe, it, expect } from 'bun:test'
import {
  insertPurchaseSchema,
  insertPurchaseTransactionSchema,
  insertContentLicenseSchema,
  insertContentLicenseGrantSchema,
  insertPaymentGatewaySchema,
  insertPurchaseOptionSchema,
  purchaseStatusEnum,
  transactionTypeEnum,
  transactionStatusEnum,
  contentLicenseTypeEnum,
  contentLicenseStatusEnum,
  licenseGrantStatusEnum,
  paymentProviderEnum,
  platformEnum,
} from '../../schema/finance'

describe('finance schemas', () => {
  describe('purchases', () => {
    const validPurchase = {
      studentId: 1,
      courseId: 1,
      purchaseOptionId: 1,
      paymentGatewayId: 1,
      status: 'initiated' as const,
      amount: 500,
      currency: 'ETB',
    }

    it('accepts valid purchase insert', () => {
      const result = insertPurchaseSchema.safeParse(validPurchase)
      expect(result.success).toBe(true)
    })

    it('accepts bundle purchase', () => {
      const result = insertPurchaseSchema.safeParse({
        ...validPurchase,
        courseId: undefined,
        bundleId: 1,
      })
      expect(result.success).toBe(true)
    })

    it('validates amount min', () => {
      expect(insertPurchaseSchema.safeParse({ ...validPurchase, amount: -1 }).success).toBe(false)
    })

    it('validates currency format', () => {
      expect(insertPurchaseSchema.safeParse({ ...validPurchase, currency: 'ET' }).success).toBe(
        false,
      )
      expect(insertPurchaseSchema.safeParse({ ...validPurchase, currency: 'USD' }).success).toBe(
        true,
      )
    })

    it('accepts all purchase statuses', () => {
      for (const status of purchaseStatusEnum.options) {
        const result = insertPurchaseSchema.safeParse({ ...validPurchase, status })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('purchase transactions', () => {
    const validTransaction = {
      purchaseId: 1,
      transactionType: 'authorization' as const,
      amount: 500,
      currency: 'ETB',
      status: 'pending' as const,
      idempotencyKey: 'key-123',
    }

    it('accepts valid transaction insert', () => {
      const result = insertPurchaseTransactionSchema.safeParse(validTransaction)
      expect(result.success).toBe(true)
    })

    it('requires idempotencyKey', () => {
      const result = insertPurchaseTransactionSchema.safeParse({
        purchaseId: 1,
        transactionType: 'authorization',
        amount: 500,
        status: 'pending',
      })
      expect(result.success).toBe(false)
    })

    it('validates idempotencyKey max length', () => {
      const result = insertPurchaseTransactionSchema.safeParse({
        ...validTransaction,
        idempotencyKey: 'x'.repeat(256),
      })
      expect(result.success).toBe(false)
    })

    it('validates amount min', () => {
      expect(
        insertPurchaseTransactionSchema.safeParse({
          ...validTransaction,
          amount: -1,
        }).success,
      ).toBe(false)
    })

    it('accepts all transaction types', () => {
      for (const type of transactionTypeEnum.options) {
        const result = insertPurchaseTransactionSchema.safeParse({
          ...validTransaction,
          transactionType: type,
        })
        expect(result.success).toBe(true)
      }
    })

    it('accepts all transaction statuses', () => {
      for (const status of transactionStatusEnum.options) {
        const result = insertPurchaseTransactionSchema.safeParse({
          ...validTransaction,
          status,
        })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('content licenses', () => {
    const validLicense = {
      lessonId: 1,
      licenseType: 'perpetual' as const,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-01-01'),
      status: 'active' as const,
      gracePeriodDays: 90,
    }

    it('accepts valid license insert', () => {
      const result = insertContentLicenseSchema.safeParse(validLicense)
      expect(result.success).toBe(true)
    })

    it('validates renewalReminderDays range', () => {
      expect(
        insertContentLicenseSchema.safeParse({
          ...validLicense,
          renewalReminderDays: -1,
        }).success,
      ).toBe(false)
      expect(
        insertContentLicenseSchema.safeParse({
          ...validLicense,
          renewalReminderDays: 366,
        }).success,
      ).toBe(false)
    })

    it('validates gracePeriodDays range', () => {
      expect(
        insertContentLicenseSchema.safeParse({
          ...validLicense,
          gracePeriodDays: -1,
        }).success,
      ).toBe(false)
      expect(
        insertContentLicenseSchema.safeParse({
          ...validLicense,
          gracePeriodDays: 366,
        }).success,
      ).toBe(false)
    })

    it('validates costAmount min', () => {
      expect(
        insertContentLicenseSchema.safeParse({
          ...validLicense,
          costAmount: -1,
        }).success,
      ).toBe(false)
    })

    it('accepts all license types', () => {
      for (const type of contentLicenseTypeEnum.options) {
        const result = insertContentLicenseSchema.safeParse({
          ...validLicense,
          licenseType: type,
        })
        expect(result.success).toBe(true)
      }
    })

    it('accepts all license statuses', () => {
      for (const status of contentLicenseStatusEnum.options) {
        const result = insertContentLicenseSchema.safeParse({
          ...validLicense,
          status,
        })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('content license grants', () => {
    const validGrant = {
      contentLicenseId: 1,
      studentId: 1,
      accessExpiresAt: new Date('2027-01-01'),
      status: 'active' as const,
    }

    it('accepts valid grant insert', () => {
      const result = insertContentLicenseGrantSchema.safeParse(validGrant)
      expect(result.success).toBe(true)
    })

    it('requires accessExpiresAt', () => {
      const result = insertContentLicenseGrantSchema.safeParse({
        contentLicenseId: 1,
        studentId: 1,
        status: 'active',
      })
      expect(result.success).toBe(false)
    })

    it('accepts all grant statuses', () => {
      for (const status of licenseGrantStatusEnum.options) {
        const result = insertContentLicenseGrantSchema.safeParse({
          ...validGrant,
          status,
        })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('payment gateways', () => {
    const validGateway = {
      providerName: 'telebirr' as const,
      displayName: 'Telebirr',
      isEnabled: true,
      requiresDisclosure: false,
    }

    it('accepts valid gateway insert', () => {
      const result = insertPaymentGatewaySchema.safeParse(validGateway)
      expect(result.success).toBe(true)
    })

    it('accepts all payment providers', () => {
      for (const provider of paymentProviderEnum.options) {
        const result = insertPaymentGatewaySchema.safeParse({
          ...validGateway,
          providerName: provider,
        })
        expect(result.success).toBe(true)
      }
    })

    it('validates displayName max length', () => {
      expect(
        insertPaymentGatewaySchema.safeParse({
          ...validGateway,
          displayName: 'x'.repeat(101),
        }).success,
      ).toBe(false)
    })
  })

  describe('purchase options', () => {
    const validOption = {
      courseId: 1,
      paymentGatewayId: 1,
      platform: 'web' as const,
      productId: 'prod-123',
      displayName: 'Course Access',
      durationDays: 30,
      priceAmount: 500,
      priceCurrency: 'ETB',
      isActive: true,
    }

    it('accepts valid option insert', () => {
      const result = insertPurchaseOptionSchema.safeParse(validOption)
      expect(result.success).toBe(true)
    })

    it('accepts bundle option', () => {
      const result = insertPurchaseOptionSchema.safeParse({
        ...validOption,
        courseId: undefined,
        bundleId: 1,
      })
      expect(result.success).toBe(true)
    })

    it('validates durationDays positive', () => {
      expect(
        insertPurchaseOptionSchema.safeParse({
          ...validOption,
          durationDays: 0,
        }).success,
      ).toBe(false)
    })

    it('validates priceAmount min', () => {
      expect(
        insertPurchaseOptionSchema.safeParse({
          ...validOption,
          priceAmount: -1,
        }).success,
      ).toBe(false)
    })

    it('validates productId min length', () => {
      expect(
        insertPurchaseOptionSchema.safeParse({
          ...validOption,
          productId: '',
        }).success,
      ).toBe(false)
    })

    it('accepts all platforms', () => {
      for (const platform of platformEnum.options) {
        const result = insertPurchaseOptionSchema.safeParse({
          ...validOption,
          platform,
        })
        expect(result.success).toBe(true)
      }
    })
  })
})
