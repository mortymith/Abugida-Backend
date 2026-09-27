/**
 * Barrel for Settings server functions (spec 08). Client code imports from
 * here so wrapper modules (client-safe) stay decoupled from impl modules
 * (server-only, dynamically imported inside handlers).
 */

// S-6.1 General
export {
  getGeneralSettings,
  getGeneralSettingsReference,
  saveGeneralSettings,
} from './settings.general'

// S-6.2 Team
export {
  getTeamPage,
  inviteTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
  cancelTeamInvitation,
} from './settings.team'

// S-6.3 Integrations
export {
  getIntegrations,
  saveEmailIntegration,
  saveAnalyticsIntegration,
  togglePaymentGateway,
  savePaymentGatewayConfig,
} from './settings.integrations'

// S-6.4 Branding
export {
  getBranding,
  saveBranding,
  resetBranding,
  getBrandingUploadUrl,
  getBrandingAssetUrl,
} from './settings.branding'

// S-6.5 Profile
export {
  getProfile,
  updateProfile,
  getAvatarUploadUrl,
  markAvatarUploaded,
  getProfileSecurity,
  changePassword,
  revokeSession,
  revokeOtherSessions,
  unlinkConnectedAccount,
  getAccountLinkUrl,
  startMfaEnrollment,
  verifyMfaEnrollment,
  disableMfa,
} from './settings.profile'

// S-6.6 Billing
export { getBillingPage } from './settings.billing'

// S-6.7 API & Webhooks
export {
  getApiKeys,
  createApiKey,
  revokeApiKey,
  getWebhookEndpoints,
  saveWebhookEndpoint,
  deleteWebhookEndpoint,
  sendWebhookTestEvent,
  getWebhookDeliveries,
} from './settings.api-webhooks'

// S-6.8 Security & Audit
export {
  getSecurityPolicies,
  saveSecurityPolicies,
  getAuditLog,
  exportAuditLogCsv,
} from './settings.security'

// S-6.9 Roles & Permissions
export { getRolesPage, saveRolePermissions, createCustomRole } from './settings.roles'

// S-6.10 Privacy
export {
  getPrivacyPage,
  saveRetentionPolicy,
  previewRetentionMatches,
  getDataRequests,
  createDataRequest,
  completeDataExport,
  eraseStudentData,
  getConsentLog,
} from './settings.privacy'
