/**
 * @abugida/auth — shared authentication layer for Hono and TanStack Start
 * apps, built on better-auth. See README.md for setup guides.
 */

// Core
export {
  createAuth,
  buildProviderRegistry,
  buildSocialProviders,
  buildSessionOptions,
  buildAdvancedOptions,
  buildRateLimitOptions,
} from "./core/auth";
export type { AuthInstance } from "./core/auth";
export { resolveSession, revokeSession, refreshSession } from "./core/session";
export type { ResolvedSession } from "./core/session";
export { getValidAccessToken } from "./core/token-refresh";
export type { GetAccessTokenParams, AccessTokenResult } from "./core/token-refresh";
export { verifyRequestOrigin } from "./core/csrf";
export type { OriginCheckOptions } from "./core/csrf";
export { noopLogger, createConsoleLogger, redact } from "./core/logger";
export type { Logger, LogContext } from "./core/logger";
export { isProduction, isDevelopment, isTest, parseEnvironment } from "./core/environment";
export type {
  AuthConfig,
  AuthEnvironment,
  AuthDatabaseSchema,
  AuthDatabaseConfig,
  ProvidersConfig,
  SessionConfig,
  CorsConfig,
  RateLimitConfig,
  AppleProviderCredentials,
  GoogleProviderCredentials,
  BaseProviderCredentials,
  AuthProviderDefinition,
  AuthError,
  AuthErrorKind,
  AuthResult,
} from "./core/types";
export { ok, err } from "./core/types";

// Providers
export { appleProvider, googleProvider, ProviderRegistry } from "./providers";
export { generateAppleClientSecret } from "./providers/apple";

// Config
export { validateAuthConfig, withDefaults } from "./config";

// Note: framework-specific middleware is intentionally NOT re-exported here.
// Import from "@abugida/auth/hono" or "@abugida/auth/tanstack" so consuming
// apps don't pull Hono or TanStack Start into a bundle that doesn't use it.
