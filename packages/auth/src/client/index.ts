/**
 * Client-safe entry point for @abugida/auth.
 *
 * Only exports types and client-side utilities. No server-only imports
 * (better-auth, node:crypto, DB adapters, better-auth-telemetry, etc.).
 */

// TanStack Start client integration
export { createAuthClient, type AuthClientOptions } from '../middleware/tanstack/client'

// Core types needed by client code
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
  GoogleProviderCredentials,
  TelegramProviderCredentials,
  BaseProviderCredentials,
  AuthProviderDefinition,
  AuthError,
  AuthErrorKind,
  AuthResult,
} from '../core/types'
export { ok, err } from '../core/types'

// Provider types (for client-side provider configuration if needed)
export type { ProviderRegistry } from '../providers/base'
