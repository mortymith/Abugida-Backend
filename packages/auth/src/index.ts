/**
 * @abugida/auth — the single source of truth for authentication in the Abugida
 * monorepo. One Better Auth instance definition, one plugin registry, one
 * environment contract, shared by `app/api` and `app/dashboard`.
 *
 * Server code uses `createAbugidaAuth()` from here. Framework middleware lives
 * in `@abugida/auth/hono` and `@abugida/auth/tanstack/*`, the browser client in
 * `@abugida/auth/client`, the env contract in `@abugida/auth/env` and the role
 * vocabulary in `@abugida/auth/roles`, so nothing pulls server code into a
 * bundle that does not need it.
 */

// Instance
export { createAbugidaAuth, type AbugidaAuthOptions } from './core/server'

// Session
export { resolveSession, revokeSession, refreshSession } from './core/session'
export type { ResolvedSession } from './core/session'

// Behaviour behind the TanStack server functions, for apps that must declare
// them in their own source tree (see core/handlers.ts).
export {
  serverSession,
  serverRefreshedSession,
  serverSignOut,
  serverAccessToken,
} from './core/handlers'
export { getValidAccessToken } from './core/token-refresh'
export type { GetAccessTokenParams, AccessTokenResult } from './core/token-refresh'
export { buildTokenPlugins, DEFAULT_TOKEN_AUDIENCE } from './core/tokens'
export { verifyRequestOrigin } from './core/csrf'
export type { OriginCheckOptions } from './core/csrf'
export { noopLogger, createConsoleLogger, redact } from './core/logger'
export type { Logger, LogContext } from './core/logger'
export { isProduction, isDevelopment, isTest, parseEnvironment } from './core/environment'
export type { AuthInstance } from './core/auth'

// Authorization
export {
  activeOrganizationId,
  resolveOrganizationAccess,
  requireOrganizationRole,
  resolveUserPlatformRole,
} from './core/authorize'
export type {
  MembershipStore,
  OrganizationAccess,
  OrganizationAccessOptions,
  RequireOrganizationRoleOptions,
} from './core/authorize'

// Roles
export {
  PLATFORM_ROLES,
  ROLE_PRIORITY,
  isPlatformRole,
  mapBetterAuthRoleToPlatformRole,
  highestPlatformRole,
  hasAtLeastRole,
} from './core/roles'
export type { PlatformRole } from './core/roles'

// Providers
export { googleProvider, ProviderRegistry } from './providers'
export { buildTelegramPlugins, validateTelegramCredentials } from './providers/telegram'

// Plugins (the authoritative registry — exposed for tests and diagnostics,
// not for extension)
export {
  buildServerPlugins,
  buildTwoFactorPlugin,
  buildOrganizationPlugin,
  buildOpenApiPlugin,
  ORGANIZATION_ADDITIONAL_FIELDS,
} from './plugins/server'

// Config
export { validateAuthConfig, withDefaults } from './config'

// OpenAPI (generated from the live instance by better-auth's OpenAPI plugin)
export { getAuthOpenApiDocument, mergeAuthOpenApiDocument } from './core/openapi'
export type {
  AuthOpenApiDocument,
  AuthOpenApiPathItem,
  AuthOpenApiSecurityScheme,
  MergeAuthOpenApiOptions,
  OpenApiDocumentLike,
} from './core/openapi'

// Served route policy (pure data + predicates; also `@abugida/auth/routes`, so
// a framework entry can use them without pulling in better-auth's server)
export {
  isOpenApiPluginPath,
  isPasswordlessDisabledPath,
  normalizeAuthBasePath,
  OPENAPI_PLUGIN_PATHS,
  PASSWORDLESS_DISABLED_PATHS,
  PASSWORDLESS_DISABLED_PREFIXES,
  PASSWORDLESS_DISABLED_TEMPLATES,
} from './core/routes'

// Types
export type {
  AuthConfig,
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
} from './core/types'
export { ok, err } from './core/types'

// Note: the environment contract (`authEnvShape`, `resolveAuthEnv`) is
// deliberately *not* re-exported here — it lives in `@abugida/auth/env` so an
// app config can import it without loading better-auth's server bundle. The
// role vocabulary is likewise available on its own via `@abugida/auth/roles`.
//
// Note: framework-specific middleware is intentionally NOT re-exported here
// either. Import from "@abugida/auth/hono" or "@abugida/auth/tanstack" so
// consuming apps don't pull Hono or TanStack Start into a bundle that doesn't
// use it.
