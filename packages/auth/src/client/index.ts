/**
 * Client-safe entry point for @abugida/auth.
 *
 * Only exports the browser client, the plugin registry that mirrors the
 * server, and pure types. No server-only imports (better-auth server,
 * database adapters, `@abugida/database`, …).
 */

export { createAuthClient, type AuthClientOptions } from '../middleware/tanstack/client'
export { buildClientPlugins } from './plugins'

export type { AuthInstance } from '../core/auth'
export type { ResolvedSession } from '../core/session'
export type {
  AuthConfig,
  AuthEnvironment,
  AuthDatabaseSchema,
  AuthDatabaseConfig,
  ProvidersConfig,
  SessionConfig,
  CorsConfig,
  RateLimitConfig,
  TokensConfig,
  TwoFactorConfig,
  OrganizationConfig,
  GoogleProviderCredentials,
  TelegramProviderCredentials,
  BaseProviderCredentials,
  AuthProviderDefinition,
  AuthError,
  AuthErrorKind,
  AuthResult,
} from '../core/types'
export { ok, err } from '../core/types'

export {
  PLATFORM_ROLES,
  ROLE_PRIORITY,
  isPlatformRole,
  mapBetterAuthRoleToPlatformRole,
  highestPlatformRole,
  hasAtLeastRole,
} from '../core/roles'
export type { PlatformRole } from '../core/roles'

export { ORGANIZATION_ADDITIONAL_FIELDS } from '../plugins/constants'

export type { ProviderRegistry } from '../providers/base'
