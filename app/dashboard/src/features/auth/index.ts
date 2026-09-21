export { useSession } from './hooks/auth.session'
export { useRole } from './hooks/auth.role'
export {
  PLATFORM_ROLES,
  REVENUE_ROLES,
  ROLE_PRIORITY,
  hasAtLeastRole,
  isPlatformRole,
  mapBetterAuthRoleToPlatformRole,
  type PlatformRole,
} from './auth.roles'
export { getServerRole, requireRolesBeforeLoad } from './server/auth.roles.server'
export { useLastProvider, type Provider } from './hooks/auth.provider-memory'
export { ProviderButton } from './components/auth.provider-button'
export { RedirectingOverlay } from './components/auth.redirecting-overlay'
export { LoginForm } from './components/auth.login-form'
export { SignupStep1 } from './components/auth.signup-step-1'
export { SignupStep2 } from './components/auth.signup-step-2'
export { SignupStep3 } from './components/auth.signup-step-3'
export { MfaInput } from './components/auth.mfa-input'
export { WorkspaceSchema, MfaCodeSchema, BackupCodeSchema } from './schemas/auth.signup.schema'
export type { WorkspaceInput, MfaCodeInput, BackupCodeInput } from './schemas/auth.signup.schema'
