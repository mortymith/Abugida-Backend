import { describe, expect, test } from 'bun:test'
import {
  auditLogQuerySchema,
  avatarUploadSchema,
  brandingUploadSchema,
  changePasswordSchema,
  createApiKeySchema,
  createCustomRoleSchema,
  saveBrandingSchema,
  saveGeneralSettingsSchema,
  saveWebhookEndpointSchema,
  saveSecurityPoliciesSchema,
  typedEraseSchema,
  updateProfileSchema,
  saveRetentionPolicySchema,
} from '#/features/settings/schemas/settings.schema'

describe('saveGeneralSettingsSchema', () => {
  const base = {
    platformName: 'Abugida Academy',
    supportEmail: 'support@abugida.com',
    timezone: 'Africa/Addis_Ababa',
    dateFormat: 'DD/MM/YYYY' as const,
    defaultInstructorId: null,
    defaultCategoryId: null,
    autoNotifyOnPublication: false,
    dailyDigestEmails: false,
  }

  test('accepts the full valid payload', () => {
    expect(saveGeneralSettingsSchema.parse(base).platformName).toBe('Abugida Academy')
  })

  test('rejects invalid support email and date format', () => {
    expect(() => saveGeneralSettingsSchema.parse({ ...base, supportEmail: 'nope' })).toThrow()
    expect(() => saveGeneralSettingsSchema.parse({ ...base, dateFormat: 'DD.MM.YYYY' })).toThrow()
  })

  test('normalizes emails to lowercase trimmed', () => {
    const parsed = saveGeneralSettingsSchema.parse({
      ...base,
      supportEmail: '  Support@Abugida.com ',
    })
    expect(parsed.supportEmail).toBe('support@abugida.com')
  })
})

describe('changePasswordSchema', () => {
  test('accepts a strong matching pair', () => {
    const parsed = changePasswordSchema.parse({
      currentPassword: 'old-password',
      newPassword: 'Sup3r-secret',
      confirmNewPassword: 'Sup3r-secret',
    })
    expect(parsed.newPassword).toBe('Sup3r-secret')
  })

  test('rejects mismatched confirmation', () => {
    expect(() =>
      changePasswordSchema.parse({
        currentPassword: 'old',
        newPassword: 'Sup3r-secret',
        confirmNewPassword: 'different',
      }),
    ).toThrow()
  })

  test('enforces length and character classes', () => {
    for (const bad of ['Sh0rt', 'alllowercase1', 'ALLUPPERCASE1', 'NoDigitsHere']) {
      expect(() =>
        changePasswordSchema.parse({
          currentPassword: 'old',
          newPassword: bad,
          confirmNewPassword: bad,
        }),
      ).toThrow()
    }
  })
})

describe('updateProfileSchema', () => {
  test('trims the name and accepts preferences', () => {
    const parsed = updateProfileSchema.parse({
      name: '  Jane Smith ',
      languagePreference: 'en',
      timezone: 'Africa/Addis_Ababa',
    })
    expect(parsed.name).toBe('Jane Smith')
  })

  test('rejects empty names', () => {
    expect(() =>
      updateProfileSchema.parse({ name: '   ', languagePreference: 'en', timezone: 'UTC' }),
    ).toThrow()
  })
})

describe('avatarUploadSchema', () => {
  test('accepts image types only', () => {
    expect(
      avatarUploadSchema.parse({ fileName: 'me.png', contentType: 'image/png' }).contentType,
    ).toBe('image/png')
    expect(() =>
      avatarUploadSchema.parse({ fileName: 'evil.exe', contentType: 'application/octet-stream' }),
    ).toThrow()
  })
})

describe('saveBrandingSchema', () => {
  test('accepts hex colors and rejects others', () => {
    const parsed = saveBrandingSchema.parse({
      companyName: 'Abugida Academy',
      logoObjectKey: 'branding/logo-1.png',
      faviconObjectKey: null,
      primaryColor: '#8b5cf6',
      secondaryColor: null,
      backgroundColor: '#f8fafc',
      customCss: null,
    })
    expect(parsed.primaryColor).toBe('#8b5cf6')
    expect(() =>
      saveBrandingSchema.parse({
        companyName: 'X',
        logoObjectKey: null,
        faviconObjectKey: null,
        primaryColor: 'purple',
        secondaryColor: null,
        backgroundColor: null,
        customCss: null,
      }),
    ).toThrow()
  })

  test('caps custom CSS length', () => {
    expect(() =>
      saveBrandingSchema.parse({
        companyName: 'X',
        logoObjectKey: null,
        faviconObjectKey: null,
        primaryColor: null,
        secondaryColor: null,
        backgroundColor: null,
        customCss: 'a'.repeat(20_001),
      }),
    ).toThrow()
  })
})

describe('brandingUploadSchema', () => {
  test('restricts kinds', () => {
    expect(
      brandingUploadSchema.parse({ kind: 'logo', fileName: 'a.svg', contentType: 'image/svg+xml' })
        .kind,
    ).toBe('logo')
    expect(() =>
      brandingUploadSchema.parse({ kind: 'banner', fileName: 'a.png', contentType: 'image/png' }),
    ).toThrow()
  })
})

describe('createApiKeySchema', () => {
  test('defaults scopes to empty', () => {
    expect(createApiKeySchema.parse({ name: 'Zapier' }).scopes).toEqual([])
  })

  test('requires a name', () => {
    expect(() => createApiKeySchema.parse({ name: '  ' })).toThrow()
  })
})

describe('saveWebhookEndpointSchema', () => {
  test('requires https URLs at the type level too (impl adds the protocol guard)', () => {
    const parsed = saveWebhookEndpointSchema.parse({
      publicId: null,
      url: 'https://crm.example.com/hook',
      eventType: 'enrollment.created',
      isActive: true,
    })
    expect(parsed.publicId).toBeNull()
    expect(() =>
      saveWebhookEndpointSchema.parse({
        publicId: null,
        url: 'not-a-url',
        eventType: 'enrollment.created',
        isActive: true,
      }),
    ).toThrow()
  })
})

describe('saveSecurityPoliciesSchema', () => {
  test('accepts CIDR ranges and rejects junk', () => {
    const parsed = saveSecurityPoliciesSchema.parse({
      requireAdminMfa: true,
      sessionTimeoutHours: 8,
      allowedIpRanges: ['10.0.0.0/8'],
    })
    expect(parsed.allowedIpRanges).toEqual(['10.0.0.0/8'])
    expect(() =>
      saveSecurityPoliciesSchema.parse({
        requireAdminMfa: true,
        sessionTimeoutHours: 8,
        allowedIpRanges: ['drop table'],
      }),
    ).toThrow()
  })

  test('rejects absurd session timeouts', () => {
    expect(() =>
      saveSecurityPoliciesSchema.parse({
        requireAdminMfa: false,
        sessionTimeoutHours: 1000,
        allowedIpRanges: [],
      }),
    ).toThrow()
  })
})

describe('auditLogQuerySchema', () => {
  test('coerces page numbers', () => {
    expect(auditLogQuerySchema.parse({ page: '3' }).page).toBe(3)
  })

  test('rejects non-positive pages', () => {
    expect(() => auditLogQuerySchema.parse({ page: 0 })).toThrow()
  })
})

describe('createCustomRoleSchema', () => {
  test('enforces lowercase naming', () => {
    expect(
      createCustomRoleSchema.parse({ roleName: 'content-manager', cloneFrom: 'editor' }).roleName,
    ).toBe('content-manager')
    expect(() =>
      createCustomRoleSchema.parse({ roleName: 'Content Manager', cloneFrom: 'editor' }),
    ).toThrow()
  })
})

describe('saveRetentionPolicySchema', () => {
  test('bounds the thresholds', () => {
    const parsed = saveRetentionPolicySchema.parse({
      anonymizeEnabled: true,
      anonymizeInactivityMonths: 12,
      warningEmailDays: 14,
      deleteEnabled: false,
      deleteInactivityMonths: 24,
      scopeProfile: true,
      scopeMessages: true,
      scopeCertificates: false,
    })
    expect(parsed.anonymizeInactivityMonths).toBe(12)
    expect(() =>
      saveRetentionPolicySchema.parse({
        anonymizeEnabled: true,
        anonymizeInactivityMonths: 500,
        warningEmailDays: 14,
        deleteEnabled: false,
        deleteInactivityMonths: 24,
        scopeProfile: true,
        scopeMessages: true,
        scopeCertificates: false,
      }),
    ).toThrow()
  })
})

describe('typedEraseSchema', () => {
  test('accepts only the exact ERASE literal', () => {
    const publicId = '0b8b8f8e-1234-4321-8765-abcdefabcdef'
    expect(typedEraseSchema.parse({ publicId, confirmation: 'ERASE' }).confirmation).toBe('ERASE')
    expect(() => typedEraseSchema.parse({ publicId, confirmation: 'erase' })).toThrow()
    expect(() => typedEraseSchema.parse({ publicId, confirmation: 'DELETE' })).toThrow()
  })
})
