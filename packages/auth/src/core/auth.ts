/**
 * @module core/auth
 *
 * `createAbugidaAuth()` (in `core/server.ts`) is the only entry point
 * consumers use; it delegates here. This module:
 *   1. validates config (fail fast on bad env/credentials)
 *   2. builds the `socialProviders` block from the pluggable provider registry
 *   3. registers the authoritative plugin set (`plugins/server.ts`)
 *   4. wires the Drizzle adapter using the injected db + schema
 *   5. returns a betterAuth instance plus a few package-specific helpers
 *
 * Everything downstream (Hono middleware, TanStack integration) consumes
 * only the returned `AuthInstance` — they never touch better-auth directly.
 */

import { betterAuth, type Auth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { AuthConfig, AuthDatabaseSchema } from './types'
import { validateAuthConfig, withDefaults } from '../config'
import { googleProvider } from '../providers'
import { buildServerPlugins } from '../plugins/server'
import { PASSWORDLESS_DISABLED_PATHS, PASSWORDLESS_DISABLED_TEMPLATES } from './routes'
import { ProviderRegistry } from '../providers/base'
import { resolveSession, revokeSession, refreshSession } from './session'
import { getValidAccessToken } from './token-refresh'
import { noopLogger, redact, type Logger } from './logger'
import { isProduction } from './environment'

export interface AuthInstance {
  /**
   * The underlying better-auth instance, for advanced/escape-hatch use.
   * Typed as `Auth` (better-auth's own default options generic) rather than
   * the precise inferred options type of this factory's `betterAuth()` call,
   * since consumers pass this across module/package boundaries where the
   * exact literal options type isn't meaningful.
   */
  raw: Auth
  /**
   * Better Auth's server API for the current request — the typed route for
   * plugin endpoints (two-factor verification, organizations, …). Always call
   * it with the caller's `headers`; it carries the session.
   */
  api: Auth['api']
  /**
   * The Drizzle handle this instance was built with. Used by the shared
   * authorization helpers (`core/authorize.ts`) so apps do not each query the
   * `member` table their own way.
   */
  db: unknown
  /** Resolve a session from a Headers object (Hono, TanStack, anywhere with a Request). */
  getSession: (headers: Headers) => ReturnType<typeof resolveSession>
  /** Same as getSession, but bypasses better-auth's short-lived cookie cache. */
  refreshSession: (headers: Headers) => ReturnType<typeof refreshSession>
  signOut: (headers: Headers) => ReturnType<typeof revokeSession>
  /** Returns a valid (auto-refreshed) OAuth access token for a linked provider account. */
  getAccessToken: (params: {
    userId: string
    providerId: string
  }) => ReturnType<typeof getValidAccessToken>
  /** The resolved (defaults-applied) config, useful for framework adapters. */
  config: AuthConfig
  /** The logger this instance was created with (defaults to a no-op logger). */
  logger: Logger
}

// ---------------------------------------------------------------------------
// Pure option builders — exported so they can be unit tested without
// constructing a real betterAuth() instance (which needs a live DB adapter).
// ---------------------------------------------------------------------------

export function buildProviderRegistry(config: AuthConfig): ProviderRegistry {
  const registry = new ProviderRegistry()
  registry.register(googleProvider)

  for (const [id, entry] of Object.entries(config.providers.custom ?? {})) {
    registry.register({ ...entry.definition, id })
  }

  return registry
}

export function buildSocialProviders(
  config: AuthConfig,
  registry: ProviderRegistry,
): Record<string, unknown> {
  const social: Record<string, unknown> = {}

  if (config.providers.google) {
    social.google = registry.get('google')!.toBetterAuthConfig(config.providers.google)
  }
  for (const [id, entry] of Object.entries(config.providers.custom ?? {})) {
    social[id] = registry.get(id)!.toBetterAuthConfig(entry.credentials)
  }

  return social
}

export function buildSessionOptions(config: AuthConfig) {
  return {
    expiresIn: config.session?.expiresInSeconds,
    updateAge: config.session?.updateAgeSeconds,
    // Short in-memory/edge cache so a request that calls getSession() more
    // than once (e.g. a shared `withSession` middleware plus a route
    // handler that also checks it) doesn't hit the DB twice. 60s matches
    // better-auth's own recommended default; call `refreshSession()`
    // instead of `getSession()` wherever staleness of this magnitude is a
    // problem (e.g. immediately after a permission change).
    cookieCache: { enabled: true, maxAge: 60, strategy: 'jwe' as const },
  }
}

export function buildAdvancedOptions(config: AuthConfig) {
  return {
    // Session-fixation protection: rotate the session cookie's underlying
    // token on privilege-relevant events (better-auth default), and always
    // regenerate on sign-in rather than reusing a pre-auth cookie.
    useSecureCookies: config.session?.cookie?.secure ?? isProduction(config),
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: config.session?.cookie?.sameSite ?? 'lax',
      domain: config.session?.cookie?.domain,
    },
    cookiePrefix: config.session?.cookie?.name ?? 'abugida.session',
    // Let Better Auth generate IDs in the adapter. The database package uses
    // text primary keys without database-side defaults, so
    // `generateId: 'uuid'` would make the PostgreSQL adapter assume the DB
    // supplies UUID defaults and insert NULL into id.
  }
}

export function buildRateLimitOptions(config: AuthConfig):
  | {
      enabled: true
      window: number
      max: number
      customRules?: Record<string, { window: number; max: number } | false>
    }
  | undefined {
  if (!config.rateLimit) return undefined
  return {
    enabled: true,
    window: config.rateLimit.windowSeconds,
    max: config.rateLimit.max,
    ...(config.rateLimit.customRules ? { customRules: config.rateLimit.customRules } : {}),
  }
}

/**
 * Creates a fully configured auth instance from a validated `AuthConfig`.
 *
 * Internal building block of `createAbugidaAuth()`; exported for this
 * package's own tests, not part of the public entry point.
 */
export function createAuth<TSchema extends AuthDatabaseSchema>(
  inputConfig: AuthConfig<TSchema>,
): AuthInstance {
  const logger = inputConfig.logger ?? noopLogger

  validateAuthConfig(inputConfig, logger)
  const config = withDefaults(inputConfig) as AuthConfig

  const registry = buildProviderRegistry(config)
  const socialProviders = buildSocialProviders(config, registry)
  const plugins = buildServerPlugins(config)

  logger.info('Initializing auth instance', {
    environment: config.environment,
    providers: Object.keys(socialProviders).join(','),
    plugins: plugins.length,
  })

  const raw = betterAuth({
    baseURL: config.baseUrl,
    // Must equal the prefix the consuming app mounts the auth request handler
    // under (see middleware/hono `mountAuthRoutes`). better-auth resolves its
    // internal endpoints (sign-in/social, sign-up/email, callback/:provider,
    // get-session, sign-out, …) relative to this path.
    basePath: config.basePath,
    // The platform is passwordless: sign-in is Google or Telegram OIDC only, so
    // Better Auth's credential endpoints (email sign-in/sign-up, password
    // reset, e-mail change/verification, password change) are switched off.
    // Better Auth applies this both in its router (404) and in its OpenAPI
    // generator (path not documented), so the served surface and the
    // generated document stay in step. See core/routes.ts.
    disabledPaths: [...PASSWORDLESS_DISABLED_PATHS, ...PASSWORDLESS_DISABLED_TEMPLATES],
    secret: config.secret,
    database: drizzleAdapter(config.database.db as never, {
      provider: config.database.provider,
      schema: config.database.schema as never,
    }),
    socialProviders,
    session: buildSessionOptions(config),
    advanced: buildAdvancedOptions(config),
    // OAuth credentials are bearer credentials. Encrypt them before they are
    // persisted so a database read does not expose usable provider tokens.
    account: { encryptOAuthTokens: true },
    trustedOrigins: config.cors?.origins,
    rateLimit: buildRateLimitOptions(config),
    // The single plugin registry: Telegram (when configured), JWT/bearer (when
    // configured), two-factor and organizations. Apps cannot extend it.
    plugins,
    // better-auth issues + validates its own CSRF (state/PKCE) tokens for the
    // OAuth redirect flow automatically; `trustedOrigins` above is what scopes
    // which origins are allowed to complete a flow at all. See core/csrf.ts
    // for the additional origin-check layer applied to non-OAuth mutating
    // endpoints (logout, session refresh) by the framework middleware.
    ...config.betterAuthOverrides,
  })

  const authApi = raw as unknown as Auth

  return {
    raw: authApi,
    api: authApi.api,
    db: config.database.db,
    getSession: (headers: Headers) => resolveSession(authApi, headers, { logger }),
    refreshSession: (headers: Headers) => refreshSession(authApi, headers, logger),
    signOut: (headers: Headers) => revokeSession(authApi, headers, logger),
    getAccessToken: (params) => getValidAccessToken(authApi, params, logger),
    config,
    logger,
  }
}

// Re-export so consumers can log config fields safely if they build their
// own diagnostics around AuthInstance.
export { redact }
