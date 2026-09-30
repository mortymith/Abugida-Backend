/**
 * Public API for the auth feature (spec Section 0). Route files and other
 * features import from here, never from a file inside `auth/`.
 */

// ── Pure logic (S-0.1 … S-0.4) ────────────────────────────────────────────
export {
  PROVIDERS,
  isProvider,
  orderProviders,
  providerDisabledReason,
  providerLabel,
  formatCountdown,
  formatClock,
  countdownAnnouncement,
  type Provider,
  type ProviderBlock,
} from './auth.providers'

export {
  callbackNotice,
  signinActionTarget,
  providerFailureMessage,
  providerUnreachableMessage,
  type SigninNotice,
  type SigninAction,
  type SigninBlockedReason,
} from './auth.signin-state'

export {
  MFA_MAX_ATTEMPTS,
  MFA_LOCKOUT_SECONDS,
  challengeNotice,
  formatClockTime,
  isLocked,
  lockLiftsAt,
  lockSecondsRemaining,
  normaliseBackupCode,
  normaliseTotpCode,
  onlyAdminRecoveryMessage,
  recoveryFor,
  remainingAttempts,
  type MfaChallengeStatus,
  type MfaNotice,
  type MfaRecovery,
} from './auth.mfa-lockout'

export {
  AUTHENTICATOR_APPS,
  BACKUP_CODE_COUNT,
  ENROLLMENT_STEPS,
  backupCodesAnnouncement,
  backupCodesFileName,
  extractTotpSecret,
  formatBackupCodeFile,
  formatManualKey,
  nextStep,
  parseOtpauthLabel,
  partialFailureMessage,
  stepAnnouncement,
  stepNumber,
  stillOffNotice,
  stripKeySeparators,
  verifyFailureMessage,
  type EnrollmentStep,
} from './auth.mfa-enrollment'

// ── Hooks ────────────────────────────────────────────────────────────────
export { useSession } from './hooks/auth.session'
export { useLogout } from './hooks/auth.logout'
export { useRole } from './hooks/auth.role'
export { useLastProvider, type Provider as LastProvider } from './hooks/auth.provider-memory'

// ── Roles ────────────────────────────────────────────────────────────────
export {
  PLATFORM_ROLES,
  COURSE_AUTHORING_ROLES,
  REVENUE_ROLES,
  REVIEW_DECISION_ROLES,
  ROLE_PRIORITY,
  hasAtLeastRole,
  isPlatformRole,
  mapBetterAuthRoleToPlatformRole,
  type PlatformRole,
} from './auth.roles'

// ── Components ───────────────────────────────────────────────────────────
export { LoginForm } from './components/auth.login-form'
export { MfaChallenge } from './components/auth.mfa-challenge'
export { MfaEnrollment } from './components/auth.mfa-enrollment'
export { MfaInput } from './components/auth.mfa-input'
export { ProviderButton } from './components/auth.provider-button'
export { RedirectingOverlay } from './components/auth.redirecting-overlay'
export { InviteClaim } from './components/auth.invite-claim'
export { SignupStep1 } from './components/auth.signup-step-1'
export { SignupStep2 } from './components/auth.signup-step-2'
export { SignupStep3 } from './components/auth.signup-step-3'

// ── Server functions ─────────────────────────────────────────────────────
export {
  getSigninAvailability,
  recordSigninOutcome,
  claimInvite,
  completeInviteClaim,
  issueInviteLink,
} from './server/auth.signin'
export {
  getMfaChallengeStatus,
  verifyMfaChallenge,
  requestAdminMfaReset,
  requestSupportMfaRecovery,
} from './server/auth.mfa'
export {
  getEnrollmentStatus,
  startEnrollment,
  confirmEnrollment,
  regenerateBackupCodes,
  replaceAuthenticator,
  disableEnrollment,
} from './server/auth.enrollment'
export {
  getSignupProviders,
  checkSubdomainAvailable,
  provisionWorkspace,
  lookupInviteWorkspace,
  type ProvisionResult,
} from './server/auth.signup'

// ── Schemas ──────────────────────────────────────────────────────────────
export {
  SignupWorkspaceSchema,
  slugFromName,
  type SignupWorkspaceInput,
} from './schemas/auth.signup.schema'
