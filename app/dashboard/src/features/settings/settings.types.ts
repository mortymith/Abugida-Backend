import type { MetricAvailability } from '#/features/dashboard/dashboard.types'

/**
 * DTOs for the Settings feature (spec 08). Every collection carries
 * availability flags so screens can render honest empty / unsupported
 * states instead of fabricated data.
 */

// ── S-6.1 General ────────────────────────────────────────────────────────────

export interface GeneralSettings {
  platformName: string | null
  supportEmail: string | null
  timezone: string | null
  dateFormat: string | null
  defaultInstructorId: string | null
  defaultCategoryId: number | null
  autoNotifyOnPublication: boolean | null
  dailyDigestEmails: boolean | null
  availability: MetricAvailability
}

export interface GeneralSettingsReference {
  instructors: Array<{ id: string; name: string }>
  categories: Array<{ id: number; name: string }>
}

export interface GeneralSettingsSaveResult {
  ok: true
  updatedAt: string
}

// ── S-6.2 Team ───────────────────────────────────────────────────────────────

export interface TeamMemberItem {
  memberId: string
  userId: string
  name: string
  email: string
  role: string
  status: 'active' | 'inactive'
  joinedAt: string
  isCurrentUser: boolean
}

export interface TeamInvitationItem {
  id: string
  email: string
  role: string | null
  status: string
  expiresAt: string
  inviterName: string | null
}

export interface TeamPage {
  members: TeamMemberItem[]
  invitations: TeamInvitationItem[]
  availability: MetricAvailability
}

// ── S-6.3 Integrations ───────────────────────────────────────────────────────

export type IntegrationKind = 'payment' | 'email' | 'analytics'

export interface PaymentGatewayItem {
  publicId: string
  providerName: string
  displayName: string
  isEnabled: boolean
  requiresDisclosure: boolean
  disclosureText: string | null
  /** True when the gateway has non-empty non-secret api config stored. */
  configured: boolean
}

export interface EmailIntegration {
  provider: 'sendgrid' | 'smtp' | null
  fromAddress: string | null
  smtpHost: string | null
  smtpPort: number | null
  smtpUser: string | null
  /** Credentials are write-only: the client never receives stored secrets. */
  hasSendGridKey: boolean
  hasSmtpPassword: boolean
  availability: MetricAvailability
}

export interface AnalyticsIntegration {
  googleAnalyticsId: string | null
  mixpanelToken: string | null
  availability: MetricAvailability
}

export interface AuthProviderIntegration {
  provider: 'google' | 'telegram'
  configured: boolean
}

export interface IntegrationsPage {
  paymentGateways: PaymentGatewayItem[]
  paymentAvailability: MetricAvailability
  email: EmailIntegration
  analytics: AnalyticsIntegration
  authProviders: AuthProviderIntegration[]
}

// ── S-6.4 Branding ───────────────────────────────────────────────────────────

export interface BrandingSettings {
  companyName: string | null
  logoObjectKey: string | null
  logoUrl: string | null
  faviconObjectKey: string | null
  faviconUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  backgroundColor: string | null
  customCss: string | null
  availability: MetricAvailability
}

export interface BrandingUploadUrl {
  objectKey: string
  uploadUrl: string
  expiresIn: number
}

// ── S-6.5 My Profile & Account ───────────────────────────────────────────────

export interface ProfileSummary {
  userId: string
  name: string | null
  email: string | null
  emailVerified: boolean
  role: string
  image: string | null
  avatarObjectKey: string | null
  avatarUrl: string | null
  languagePreference: string
  timezone: string
  availability: MetricAvailability
}

export interface ConnectedAccountItem {
  accountId: string
  providerId: string
  createdAt: string | null
}

export interface ProfileSecurityPage {
  connectedAccounts: ConnectedAccountItem[]
  /** Provider-level configuration; linking requires the provider to be set up. */
  linkableProviders: AuthProviderIntegration[]
  hasCredentialAccount: boolean
  twoFactorEnabled: boolean
  sessions: Array<{
    token: string
    isCurrent: boolean
    ipAddress: string | null
    userAgent: string | null
    createdAt: string
    expiresAt: string
  }>
  availability: MetricAvailability
}

export interface MfaEnrollment {
  /** otpauth:// URI for QR rendering and manual entry. */
  totpUri: string
  secret: string
  backupCodes: string[]
}

// ── S-6.6 Billing ────────────────────────────────────────────────────────────

export interface BillingUsage {
  students: { used: number; limit: number | null }
  seats: { used: number; limit: number | null }
}

export interface BillingPage {
  usage: BillingUsage
  /** Usage approaching-limit banner at 90% (spec) — only when a limit exists. */
  approachingLimit: boolean
  plan: { availability: MetricAvailability }
  invoices: { availability: MetricAvailability }
  paymentMethod: { availability: MetricAvailability }
}

// ── S-6.7 API & Webhooks ─────────────────────────────────────────────────────

export interface ApiKeyItem {
  publicId: string
  name: string
  keyPrefix: string
  maskedKey: string
  createdAt: string
  lastUsedAt: string | null
  isActive: boolean
}

export interface ApiKeyCreated {
  publicId: string
  /** Full plaintext key — returned exactly once, never stored or logged. */
  key: string
  name: string
}

export interface WebhookEndpointItem {
  publicId: string
  url: string
  eventType: string
  isActive: boolean
  createdAt: string
}

export interface WebhookDeliveryItem {
  publicId: string
  eventType: string
  webhookUrl: string
  status: 'pending' | 'sent' | 'failed' | 'retrying'
  responseStatus: number | null
  lastError: string | null
  attemptCount: number
  createdAt: string
}

export interface WebhookTestResult {
  delivery: WebhookDeliveryItem
}

// ── S-6.8 Security & Audit ───────────────────────────────────────────────────

export interface SecurityPolicies {
  requireAdminMfa: boolean
  sessionTimeoutHours: number | null
  allowedIpRanges: string[]
  signInMethods: Array<{ provider: string; configured: boolean }>
  availability: MetricAvailability
}

export interface AuditLogItem {
  publicId: string
  action: string
  actorName: string | null
  actorEmail: string | null
  resourceType: string | null
  resourceDescription: string | null
  ipAddress: string | null
  createdAt: string
}

export interface AuditLogPage {
  items: AuditLogItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

// ── S-6.9 Roles & Permissions ────────────────────────────────────────────────

export interface RoleItem {
  publicId: string
  name: string
  description: string | null
  isBuiltIn: boolean
  permissions: Record<string, string[]>
}

export interface RolesPage {
  roles: RoleItem[]
  /** Ordered spec 11 module list for the matrix axes. */
  modules: string[]
  capabilities: string[]
  /** Users holding each role (from Better Auth org members) for conflict checks. */
  roleMemberCounts: Record<string, number>
}

// ── S-6.10 Privacy & Data Retention ──────────────────────────────────────────

export interface RetentionPolicy {
  anonymizeEnabled: boolean
  anonymizeInactivityMonths: number
  warningEmailDays: number
  deleteEnabled: boolean
  deleteInactivityMonths: number
  scopeProfile: boolean
  scopeMessages: boolean
  scopeCertificates: boolean
}

export interface RetentionPreview {
  anonymizeMatchCount: number
  deleteMatchCount: number
  anonymizeSample: Array<{ id: string; name: string; email: string; lastActiveAt: string | null }>
}

export interface DataRequestItem {
  publicId: string
  studentId: string
  studentName: string
  studentEmail: string
  requestType: 'export' | 'delete'
  status: 'open' | 'completed'
  requestedAt: string
  slaDeadline: string
  slaDaysLeft: number
  slaWarning: boolean
  completedAt: string | null
}

export interface DataRequestsPage {
  items: DataRequestItem[]
  availability: MetricAvailability
}

export interface ConsentLogItem {
  publicId: string
  studentName: string
  studentEmail: string
  consentType: string
  consentVersion: string
  isGranted: boolean
  consentedAt: string
}

export interface ConsentLogPage {
  items: ConsentLogItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface PrivacyPage {
  policy: RetentionPolicy
  availability: MetricAvailability
}
