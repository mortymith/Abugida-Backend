import { z } from 'zod'

/**
 * Input validation for Settings server functions (spec 08). Shared between
 * the client-safe wrappers (types) and the impl modules (parsing).
 */

const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(320)
const uuidSchema = z.string().uuid()
const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color like #8b5cf6')

// ── S-6.1 General ────────────────────────────────────────────────────────────

export const saveGeneralSettingsSchema = z.object({
  platformName: z.string().trim().min(1, 'Platform name is required').max(100),
  supportEmail: emailSchema,
  timezone: z.string().trim().min(1).max(50),
  dateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']),
  defaultInstructorId: uuidSchema.nullable(),
  defaultCategoryId: z.number().int().positive().nullable(),
  autoNotifyOnPublication: z.boolean(),
  dailyDigestEmails: z.boolean(),
})
export type SaveGeneralSettingsInput = z.infer<typeof saveGeneralSettingsSchema>

// ── S-6.2 Team ───────────────────────────────────────────────────────────────

export const inviteTeamMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(['admin', 'editor', 'reviewer', 'support', 'viewer']),
})
export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>

export const updateTeamMemberRoleSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(['admin', 'editor', 'reviewer', 'support', 'viewer']),
})
export type UpdateTeamMemberRoleInput = z.infer<typeof updateTeamMemberRoleSchema>

export const removeTeamMemberSchema = z.object({ memberId: z.string().min(1) })
export type RemoveTeamMemberInput = z.infer<typeof removeTeamMemberSchema>

export const cancelInvitationSchema = z.object({ invitationId: z.string().min(1) })
export type CancelInvitationInput = z.infer<typeof cancelInvitationSchema>

// ── S-6.3 Integrations ───────────────────────────────────────────────────────

export const saveEmailIntegrationSchema = z.object({
  provider: z.enum(['sendgrid', 'smtp']),
  fromAddress: emailSchema,
  smtpHost: z.string().trim().max(200).nullable().optional(),
  smtpPort: z.number().int().min(1).max(65535).nullable().optional(),
  smtpUser: z.string().trim().max(200).nullable().optional(),
  smtpPassword: z.string().max(200).nullable().optional(),
  sendGridKey: z.string().max(200).nullable().optional(),
})
export type SaveEmailIntegrationInput = z.infer<typeof saveEmailIntegrationSchema>

export const saveAnalyticsIntegrationSchema = z.object({
  googleAnalyticsId: z
    .string()
    .trim()
    .max(50)
    .regex(/^(UA-|G-|GT-)?[A-Za-z0-9-]*$/, 'Enter a Google Analytics property id')
    .nullable(),
  mixpanelToken: z.string().trim().max(100).nullable(),
})
export type SaveAnalyticsIntegrationInput = z.infer<typeof saveAnalyticsIntegrationSchema>

export const togglePaymentGatewaySchema = z.object({
  publicId: uuidSchema,
  isEnabled: z.boolean(),
})
export type TogglePaymentGatewayInput = z.infer<typeof togglePaymentGatewaySchema>

export const savePaymentGatewayConfigSchema = z.object({
  publicId: uuidSchema,
  displayName: z.string().trim().min(1).max(100),
  requiresDisclosure: z.boolean(),
  disclosureText: z.string().trim().max(1000).nullable(),
})
export type SavePaymentGatewayConfigInput = z.infer<typeof savePaymentGatewayConfigSchema>

// ── S-6.4 Branding ───────────────────────────────────────────────────────────

export const saveBrandingSchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required').max(100),
  logoObjectKey: z.string().trim().max(500).nullable(),
  faviconObjectKey: z.string().trim().max(500).nullable(),
  primaryColor: hexColor.nullable(),
  secondaryColor: hexColor.nullable(),
  backgroundColor: hexColor.nullable(),
  customCss: z.string().max(20_000, 'Custom CSS is limited to 20,000 characters').nullable(),
})
export type SaveBrandingInput = z.infer<typeof saveBrandingSchema>

export const brandingUploadSchema = z.object({
  kind: z.enum(['logo', 'favicon']),
  fileName: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(3).max(100),
})
export type BrandingUploadInput = z.infer<typeof brandingUploadSchema>

// ── S-6.5 My Profile ─────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  languagePreference: z.string().trim().min(2).max(10),
  timezone: z.string().trim().min(1).max(50),
})
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export const avatarUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  contentType: z
    .string()
    .trim()
    .regex(/^image\/(png|jpeg|webp|gif)$/, 'Avatars must be PNG, JPEG, WebP, or GIF'),
})
export type AvatarUploadInput = z.infer<typeof avatarUploadSchema>

export const revokeSessionSchema = z.object({ token: z.string().min(1) })
export type RevokeSessionInput = z.infer<typeof revokeSessionSchema>

export const unlinkAccountSchema = z.object({
  accountId: z.string().min(1),
  providerId: z.string().min(1),
})
export type UnlinkAccountInput = z.infer<typeof unlinkAccountSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').max(200),
    newPassword: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(200)
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[0-9]/, 'Include a number'),
    confirmNewPassword: z.string().min(1, 'Confirm the new password'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  })
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export const verifyTotpSchema = z.object({ code: z.string().trim().min(6).max(8) })
export type VerifyTotpInput = z.infer<typeof verifyTotpSchema>

export const disableTotpSchema = z.object({ password: z.string().min(1).max(200) })
export type DisableTotpInput = z.infer<typeof disableTotpSchema>

// ── S-6.7 API & Webhooks ─────────────────────────────────────────────────────

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  scopes: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
})
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>

export const apiKeyIdSchema = z.object({ publicId: uuidSchema })
export type ApiKeyIdInput = z.infer<typeof apiKeyIdSchema>

export const saveWebhookEndpointSchema = z.object({
  publicId: uuidSchema.nullable(),
  url: z.string().trim().url('Enter a valid https URL').max(500),
  eventType: z.string().trim().min(1).max(200),
  isActive: z.boolean().default(true),
})
export type SaveWebhookEndpointInput = z.infer<typeof saveWebhookEndpointSchema>

export const webhookIdSchema = z.object({ publicId: uuidSchema })
export type WebhookIdInput = z.infer<typeof webhookIdSchema>

// ── S-6.8 Security & Audit ───────────────────────────────────────────────────

export const saveSecurityPoliciesSchema = z.object({
  requireAdminMfa: z.boolean(),
  sessionTimeoutHours: z.number().int().min(1).max(720).nullable(),
  allowedIpRanges: z
    .array(
      z
        .string()
        .trim()
        .max(50)
        .regex(/^[0-9a-fA-F.:/]+$/, 'Use IP addresses or CIDR ranges like 10.0.0.0/8'),
    )
    .max(50),
})
export type SaveSecurityPoliciesInput = z.infer<typeof saveSecurityPoliciesSchema>

export const auditLogQuerySchema = z.object({
  actor: z.string().trim().max(120).optional(),
  action: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).optional(),
})
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>

// ── S-6.9 Roles & Permissions ────────────────────────────────────────────────

export const saveRolePermissionsSchema = z.object({
  roleName: z.string().trim().min(1).max(50),
  permissions: z.record(z.string(), z.array(z.string())),
})
export type SaveRolePermissionsInput = z.infer<typeof saveRolePermissionsSchema>

export const createCustomRoleSchema = z.object({
  roleName: z
    .string()
    .trim()
    .min(2, 'Name is required')
    .max(50)
    .regex(/^[a-z0-9-_]+$/, 'Use lowercase letters, numbers, dashes'),
  cloneFrom: z.string().trim().min(1).max(50),
})
export type CreateCustomRoleInput = z.infer<typeof createCustomRoleSchema>

// ── S-6.10 Privacy ───────────────────────────────────────────────────────────

export const saveRetentionPolicySchema = z.object({
  anonymizeEnabled: z.boolean(),
  anonymizeInactivityMonths: z.number().int().min(1).max(120),
  warningEmailDays: z.number().int().min(1).max(90),
  deleteEnabled: z.boolean(),
  deleteInactivityMonths: z.number().int().min(1).max(120),
  scopeProfile: z.boolean(),
  scopeMessages: z.boolean(),
  scopeCertificates: z.boolean(),
})
export type SaveRetentionPolicyInput = z.infer<typeof saveRetentionPolicySchema>

export const createDataRequestSchema = z.object({
  studentPublicId: uuidSchema,
  requestType: z.enum(['export', 'delete']),
})
export type CreateDataRequestInput = z.infer<typeof createDataRequestSchema>

export const dataRequestIdSchema = z.object({ publicId: uuidSchema })
export type DataRequestIdInput = z.infer<typeof dataRequestIdSchema>

export const typedEraseSchema = z.object({
  publicId: uuidSchema,
  confirmation: z.literal('ERASE', { message: 'Type ERASE to confirm' }),
})
export type TypedEraseInput = z.infer<typeof typedEraseSchema>
