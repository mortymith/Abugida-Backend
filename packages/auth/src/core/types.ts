/**
 * @module core/types
 *
 * Shared type contracts for @abugida/auth. These types are the extension
 * points that let new OAuth providers, database schemas, and frameworks be
 * plugged in without touching core logic.
 *
 * The plugin registry is deliberately *not* an extension point: it is owned by
 * `plugins/server.ts` so every app serves the same auth surface.
 */

import type { BetterAuthOptions } from 'better-auth'
import type { Logger } from './logger'

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/** Supported deployment environments. Drives cookie/security defaults. */
export type AuthEnvironment = 'development' | 'test' | 'production'

// ---------------------------------------------------------------------------
// Database schema injection
// ---------------------------------------------------------------------------

/**
 * Minimal shape a Drizzle schema package must satisfy to be usable by this
 * package. Concrete schemas live in `@abugida/database` (or any
 * workspace-local equivalent) and are passed in by the consumer — this
 * package never imports a schema package directly, which is what keeps
 * schema versions swappable per-app.
 */
export interface AuthDatabaseSchema {
  /** Drizzle table definition for application users. */
  user: unknown
  /** Drizzle table definition for active sessions (incl. refresh tokens). */
  session: unknown
  /** Drizzle table definition linking users to OAuth provider accounts. */
  account: unknown
  /** Drizzle table definition for email/OTP verification tokens. */
  verification: unknown
}

/**
 * Dependency-injected database boundary. `db` is intentionally typed as
 * `unknown` at this layer and narrowed to a Drizzle instance inside the
 * adapter — this keeps `@abugida/auth` free of a hard dependency on any one
 * Postgres driver (node-postgres, postgres.js, Bun's native driver, etc).
 */
export interface AuthDatabaseConfig<TSchema extends AuthDatabaseSchema = AuthDatabaseSchema> {
  /** A Drizzle ORM instance (any Postgres driver). */
  db: unknown
  /** The injected schema tables, imported by the consuming app. */
  schema: TSchema
  /** Drizzle dialect. Only "pg" is supported today. */
  provider: 'pg'
}

// ---------------------------------------------------------------------------
// Provider contract
// ---------------------------------------------------------------------------

/** Credentials common to every OAuth 2.0 provider. */
export interface BaseProviderCredentials {
  clientId: string
  /** Redirect URI registered with the provider console. */
  redirectUri?: string
}

/**
 * The interface every OAuth provider module must implement. `google.ts`
 * satisfies this, and it's the shape a consumer implements to register a
 * brand-new provider (see README "Adding a provider").
 */
export interface AuthProviderDefinition<
  TCredentials extends BaseProviderCredentials = BaseProviderCredentials,
> {
  /** Unique provider id, e.g. "google" | "telegram-oidc" | "github". */
  id: string
  /** Human-readable name for logs/UI. */
  name: string
  /** OAuth scopes requested by default. */
  scopes: string[]
  /** Builds the better-auth `socialProviders` entry for this provider. */
  toBetterAuthConfig(credentials: TCredentials): Record<string, unknown>
  /** Validates credentials at startup, throwing a typed AuthConfigError. */
  validateCredentials(credentials: TCredentials): void
}

// ---------------------------------------------------------------------------
// Provider credential shapes
// ---------------------------------------------------------------------------

export interface GoogleProviderCredentials extends BaseProviderCredentials {
  clientId: string
  clientSecret: string
  /** Additional client IDs to accept id_tokens from (e.g. iOS + web clients). */
  additionalClientIds?: string[]
  accessType?: 'online' | 'offline'
  prompt?: 'none' | 'consent' | 'select_account'
}

/**
 * Telegram credentials, consumed by the `better-auth-telegram` plugin (see
 * `providers/telegram.ts`). Telegram sign-in is supported exclusively through
 * Telegram OpenID Connect (oauth.telegram.org) — a standard OAuth 2.0 + PKCE
 * redirect flow the plugin registers as a real social provider, exposed via
 * better-auth's own social sign-in routes (`POST /sign-in/social` with
 * `provider: "telegram-oidc"`). The plugin's legacy Login Widget and Mini App
 * flows are deliberately not configured; no bot token is involved.
 */
export interface TelegramProviderCredentials {
  /** Client ID from @BotFather's Web Login (OpenID Connect) settings. */
  clientId: string
  /**
   * Client Secret from @BotFather's Web Login (Bot Settings > Web Login) —
   * NOT the bot token. BotFather issues a separate secret for Web Login.
   */
  clientSecret: string
  /** Request the phone-number scope. Default: false. */
  requestPhone?: boolean
  /** Additional OIDC scopes beyond the default "openid profile". */
  scopes?: string[]
}

// ---------------------------------------------------------------------------
// Top-level configuration
// ---------------------------------------------------------------------------

export interface SessionConfig {
  /** Session lifetime in seconds. Default: 30 days. */
  expiresInSeconds?: number
  /** Sliding-expiration refresh window in seconds. Default: 1 day. */
  updateAgeSeconds?: number
  cookie?: {
    name?: string
    domain?: string
    secure?: boolean
    sameSite?: 'lax' | 'strict' | 'none'
  }
}

export interface CorsConfig {
  origins: string[]
  credentials?: boolean
}

export interface RateLimitConfig {
  /** Requests allowed within `windowSeconds` per IP+route. */
  max: number
  windowSeconds: number
  /** Optional endpoint-specific overrides for sensitive Better Auth routes. */
  customRules?: Record<string, { window: number; max: number } | false>
}

export interface ProvidersConfig {
  google?: GoogleProviderCredentials
  telegram?: TelegramProviderCredentials
  /** Escape hatch for consumer-defined providers (see AuthProviderDefinition). */
  custom?: Record<
    string,
    { definition: AuthProviderDefinition; credentials: BaseProviderCredentials }
  >
}

/**
 * Opt-in JWT issuance for service-to-client consumers (currently PowerSync).
 * When present, the shared instance registers better-auth's jwt + bearer plugins:
 * signing keys are served at `<basePath>/jwks` and tokens authenticate as
 * bearer credentials. Requires the generated `jwks` table in the consumer's
 * Drizzle schema. See core/tokens.ts.
 */
export interface TokensConfig {
  /** Issuer claim for minted JWTs. Default: the configured baseUrl. */
  issuer?: string
  /** Audience claim. Default: "abugida" — must match PowerSync client_auth.audience. */
  audience?: string | string[]
}

/**
 * Two-factor authentication policy (TOTP + backup codes).
 *
 * Owned by this package: an app supplies values through the shared auth env
 * (`config/env.ts`), never plugin options of its own, so the lockout
 * behaviour is identical in the API and the dashboard.
 */
export interface TwoFactorConfig {
  /** Issuer shown in the authenticator app. */
  issuer: string
  /** Lifetime (seconds) of the short-lived "2FA verified" cookie. */
  twoFactorCookieMaxAge?: number
  /** Lifetime (seconds) of a trusted-device cookie. */
  trustDeviceMaxAge?: number
  accountLockout?: {
    maxFailedAttempts: number
    /** better-auth's option name; not `lockDuration`. */
    durationSeconds: number
  }
}

/**
 * Organization behaviour. The plugin itself is always registered — its tables
 * are part of the shared schema — so this block only tunes behaviour.
 */
export interface OrganizationConfig {
  /** Whether a signed-in user may create their own workspace. Default: true. */
  allowUserToCreateOrganization?: boolean
}

export interface AuthConfig<TSchema extends AuthDatabaseSchema = AuthDatabaseSchema> {
  environment: AuthEnvironment
  /** Base URL of the app serving the auth endpoints, e.g. https://api.abugida.com */
  baseUrl: string
  /**
   * Path prefix under which better-auth's request handler is mounted by the
   * consuming app (e.g. `/auth`). Must equal the framework route prefix so
   * better-auth can resolve its internal endpoints (`/sign-in/social`,
   * `/sign-up/email`, `/callback/:provider`, `/get-session`, `/sign-out`, …)
   * against incoming request paths. Default: `/auth`.
   */
  basePath?: string
  /** Secret used for signing/encrypting sessions & CSRF tokens. */
  secret: string
  database: AuthDatabaseConfig<TSchema>
  providers: ProvidersConfig
  session?: SessionConfig
  cors?: CorsConfig
  rateLimit?: RateLimitConfig
  /** Enables JWT issuance (jwt + bearer plugins). Omit to disable entirely. */
  tokens?: TokensConfig
  /**
   * Structured logger for startup validation, provider errors, session
   * errors, and rate-limit events. Defaults to a no-op logger — see
   * `core/logger.ts`. Never receives secrets; sensitive fields are redacted
   * before any log call.
   */
  logger?: Logger
  /**
   * Two-factor policy. Omit only to serve an instance with 2FA disabled;
   * `createAbugidaAuth()` always supplies it from the shared env contract.
   */
  twoFactor?: TwoFactorConfig
  /** Organization behaviour. The plugin is registered either way. */
  organization?: OrganizationConfig
  /**
   * Advanced escape hatch for this package's own `createAuth()` (used by
   * `createAbugidaAuth()` and by tests). It is intentionally not reachable
   * from the public entry point: an app that merged raw better-auth options
   * here could silently fork the auth contract, which is exactly what this
   * package exists to prevent.
   */
  betterAuthOverrides?: Partial<BetterAuthOptions>
}

// ---------------------------------------------------------------------------
// Errors — discriminated union so callers can exhaustively switch on `kind`
// ---------------------------------------------------------------------------

export type AuthErrorKind =
  | 'config_invalid'
  | 'provider_error'
  | 'session_expired'
  | 'session_invalid'
  | 'csrf_mismatch'
  | 'rate_limited'
  | 'unauthorized'
  /** Authenticated, but not permitted to act on the target resource. */
  | 'forbidden'
  | 'unknown'

export interface AuthErrorBase {
  kind: AuthErrorKind
  /** Safe to show to end users; never includes secrets or stack traces. */
  message: string
  /** Original cause, for server-side logging only — never serialize this to clients. */
  cause?: unknown
}

export interface AuthConfigError extends AuthErrorBase {
  kind: 'config_invalid'
  field: string
}

export interface AuthProviderError extends AuthErrorBase {
  kind: 'provider_error'
  providerId: string
}

export interface AuthSessionError extends AuthErrorBase {
  kind: 'session_expired' | 'session_invalid'
}

export interface AuthCsrfError extends AuthErrorBase {
  kind: 'csrf_mismatch'
}

export interface AuthRateLimitError extends AuthErrorBase {
  kind: 'rate_limited'
  retryAfterSeconds: number
}

export interface AuthUnauthorizedError extends AuthErrorBase {
  kind: 'unauthorized'
}

export interface AuthForbiddenError extends AuthErrorBase {
  kind: 'forbidden'
}

export interface AuthUnknownError extends AuthErrorBase {
  kind: 'unknown'
}

export type AuthError =
  | AuthConfigError
  | AuthProviderError
  | AuthSessionError
  | AuthCsrfError
  | AuthRateLimitError
  | AuthUnauthorizedError
  | AuthForbiddenError
  | AuthUnknownError

/** Result type used throughout the package instead of throwing across module boundaries. */
export type AuthResult<T> = { ok: true; value: T } | { ok: false; error: AuthError }

export function ok<T>(value: T): AuthResult<T> {
  return { ok: true, value }
}

export function err(error: AuthError): AuthResult<never> {
  return { ok: false, error }
}
