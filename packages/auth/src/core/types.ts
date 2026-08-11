/**
 * @module core/types
 *
 * Shared type contracts for @abugida/auth. These types are the extension
 * points that let new OAuth providers, database schemas, and frameworks be
 * plugged in without touching core logic.
 */

import type { BetterAuthOptions } from "better-auth";
import type { Logger } from "./logger";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/** Supported deployment environments. Drives cookie/security defaults. */
export type AuthEnvironment = "development" | "test" | "production";

// ---------------------------------------------------------------------------
// Database schema injection
// ---------------------------------------------------------------------------

/**
 * Minimal shape a Drizzle schema package must satisfy to be usable by this
 * package. Concrete schemas live in `@abugida/db-schemas` (or any
 * workspace-local equivalent) and are passed in by the consumer — this
 * package never imports a schema package directly, which is what keeps
 * schema versions swappable per-app.
 */
export interface AuthDatabaseSchema {
  /** Drizzle table definition for application users. */
  user: unknown;
  /** Drizzle table definition for active sessions (incl. refresh tokens). */
  session: unknown;
  /** Drizzle table definition linking users to OAuth provider accounts. */
  account: unknown;
  /** Drizzle table definition for email/OTP verification tokens. */
  verification: unknown;
}

/**
 * Dependency-injected database boundary. `db` is intentionally typed as
 * `unknown` at this layer and narrowed to a Drizzle instance inside the
 * adapter — this keeps `@abugida/auth` free of a hard dependency on any one
 * Postgres driver (node-postgres, postgres.js, Bun's native driver, etc).
 */
export interface AuthDatabaseConfig<TSchema extends AuthDatabaseSchema = AuthDatabaseSchema> {
  /** A Drizzle ORM instance (any Postgres driver). */
  db: unknown;
  /** The injected schema tables, imported by the consuming app. */
  schema: TSchema;
  /** Drizzle dialect. Only "pg" is supported today. */
  provider: "pg";
}

// ---------------------------------------------------------------------------
// Provider contract
// ---------------------------------------------------------------------------

/** Credentials common to every OAuth 2.0 provider. */
export interface BaseProviderCredentials {
  clientId: string;
  /** Redirect URI registered with the provider console. */
  redirectUri?: string;
}

/**
 * The interface every OAuth provider module must implement. `apple.ts` and
 * `google.ts` both satisfy this, and it's the shape a consumer implements to
 * register a brand-new provider (see README "Adding a provider").
 */
export interface AuthProviderDefinition<TCredentials extends BaseProviderCredentials = BaseProviderCredentials> {
  /** Unique provider id, e.g. "apple" | "google" | "github". */
  id: string;
  /** Human-readable name for logs/UI. */
  name: string;
  /** OAuth scopes requested by default. */
  scopes: string[];
  /** Builds the better-auth `socialProviders` entry for this provider. */
  toBetterAuthConfig(credentials: TCredentials): Record<string, unknown>;
  /** Validates credentials at startup, throwing a typed AuthConfigError. */
  validateCredentials(credentials: TCredentials): void;
}

// ---------------------------------------------------------------------------
// Provider credential shapes
// ---------------------------------------------------------------------------

export interface AppleProviderCredentials extends BaseProviderCredentials {
  /** Apple "Services ID" — used as the OAuth client_id. */
  clientId: string;
  /** Apple Team ID (10-char alphanumeric). */
  teamId: string;
  /** Key ID for the private key registered in App Store Connect. */
  keyId: string;
  /** PKCS#8 private key (.p8 contents) used to sign the client secret JWT. */
  privateKey: string;
  /** Client secret lifetime in seconds. Apple caps this at 15777000 (~6mo). */
  clientSecretTtlSeconds?: number;
  /** true for native iOS/macOS app flows using Sign in with Apple SDK. */
  appBundleIdentifier?: string;
}

export interface GoogleProviderCredentials extends BaseProviderCredentials {
  clientId: string;
  clientSecret: string;
  /** Additional client IDs to accept id_tokens from (e.g. iOS + web clients). */
  additionalClientIds?: string[];
  accessType?: "online" | "offline";
  prompt?: "none" | "consent" | "select_account";
}

// ---------------------------------------------------------------------------
// Top-level configuration
// ---------------------------------------------------------------------------

export interface SessionConfig {
  /** Session lifetime in seconds. Default: 30 days. */
  expiresInSeconds?: number;
  /** Sliding-expiration refresh window in seconds. Default: 1 day. */
  updateAgeSeconds?: number;
  cookie?: {
    name?: string;
    domain?: string;
    secure?: boolean;
    sameSite?: "lax" | "strict" | "none";
  };
}

export interface CorsConfig {
  origins: string[];
  credentials?: boolean;
}

export interface RateLimitConfig {
  /** Requests allowed within `windowSeconds` per IP+route. */
  max: number;
  windowSeconds: number;
}

export interface ProvidersConfig {
  apple?: AppleProviderCredentials;
  google?: GoogleProviderCredentials;
  /** Escape hatch for consumer-defined providers (see AuthProviderDefinition). */
  custom?: Record<string, { definition: AuthProviderDefinition; credentials: BaseProviderCredentials }>;
}

export interface AuthConfig<TSchema extends AuthDatabaseSchema = AuthDatabaseSchema> {
  environment: AuthEnvironment;
  /** Base URL of the app serving the auth endpoints, e.g. https://api.abugida.com */
  baseUrl: string;
  /** Secret used for signing/encrypting sessions & CSRF tokens. */
  secret: string;
  database: AuthDatabaseConfig<TSchema>;
  providers: ProvidersConfig;
  session?: SessionConfig;
  cors?: CorsConfig;
  rateLimit?: RateLimitConfig;
  /**
   * Structured logger for startup validation, provider errors, session
   * errors, and rate-limit events. Defaults to a no-op logger — see
   * `core/logger.ts`. Never receives secrets; sensitive fields are redacted
   * before any log call.
   */
  logger?: Logger;
  /**
   * Escape hatch for advanced consumers who need to pass raw better-auth
   * options through. Merged in last, after our derived config, so it can
   * override anything.
   */
  betterAuthOverrides?: Partial<BetterAuthOptions>;
}

// ---------------------------------------------------------------------------
// Errors — discriminated union so callers can exhaustively switch on `kind`
// ---------------------------------------------------------------------------

export type AuthErrorKind =
  | "config_invalid"
  | "provider_error"
  | "session_expired"
  | "session_invalid"
  | "csrf_mismatch"
  | "rate_limited"
  | "unauthorized"
  | "unknown";

export interface AuthErrorBase {
  kind: AuthErrorKind;
  /** Safe to show to end users; never includes secrets or stack traces. */
  message: string;
  /** Original cause, for server-side logging only — never serialize this to clients. */
  cause?: unknown;
}

export interface AuthConfigError extends AuthErrorBase {
  kind: "config_invalid";
  field: string;
}

export interface AuthProviderError extends AuthErrorBase {
  kind: "provider_error";
  providerId: string;
}

export interface AuthSessionError extends AuthErrorBase {
  kind: "session_expired" | "session_invalid";
}

export interface AuthCsrfError extends AuthErrorBase {
  kind: "csrf_mismatch";
}

export interface AuthRateLimitError extends AuthErrorBase {
  kind: "rate_limited";
  retryAfterSeconds: number;
}

export interface AuthUnauthorizedError extends AuthErrorBase {
  kind: "unauthorized";
}

export interface AuthUnknownError extends AuthErrorBase {
  kind: "unknown";
}

export type AuthError =
  | AuthConfigError
  | AuthProviderError
  | AuthSessionError
  | AuthCsrfError
  | AuthRateLimitError
  | AuthUnauthorizedError
  | AuthUnknownError;

/** Result type used throughout the package instead of throwing across module boundaries. */
export type AuthResult<T> = { ok: true; value: T } | { ok: false; error: AuthError };

export function ok<T>(value: T): AuthResult<T> {
  return { ok: true, value };
}

export function err(error: AuthError): AuthResult<never> {
  return { ok: false, error };
}
