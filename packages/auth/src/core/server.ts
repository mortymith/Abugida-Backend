/**
 * @module core/server
 *
 * `createAbugidaAuth()` — the single entry point for building the Abugida
 * auth instance, and the only one apps are expected to use.
 *
 * It owns, in one place:
 *   - the Better Auth server instance and its plugin registry
 *     (Google, Telegram OIDC, JWT/bearer, two-factor, organizations)
 *   - session, cookie, rate-limit and trusted-origin policy
 *   - the database binding — `@abugida/database`'s `authSchema` by default,
 *     so no app re-declares or re-migrates a table
 *
 * What an app still decides, because it is app policy rather than auth
 * policy: which environment file to read, which Drizzle client to hand over,
 * and which logger to route through.
 */

import { authSchema } from '@abugida/database/auth'
import { resolveAuthEnv, type AbugidaAuthEnv } from '../config/env'
import { createAuth, type AuthInstance } from './auth'
import type { AuthDatabaseSchema } from './types'
import type { Logger } from './logger'

export interface AbugidaAuthOptions {
  /**
   * The app's parsed environment. Pass the object the app's zod schema
   * produced — usually `resolveAuthEnv(env)` from `@abugida/auth/env`, or the
   * already-projected {@link AbugidaAuthEnv} when the app resolved it at
   * startup.
   */
  env: AbugidaAuthEnv | Record<string, unknown>
  /** A Drizzle instance (any Postgres driver). */
  db: unknown
  /**
   * Drizzle tables for better-auth. Defaults to `authSchema` from
   * `@abugida/database`, which is the single source of truth for these
   * tables. Only override in tests.
   */
  schema?: AuthDatabaseSchema
  logger?: Logger
}

/**
 * Build the auth instance. Throws a typed `AuthError` (kind
 * `config_invalid`) when the environment is unusable, so a misconfigured
 * deployment fails at boot instead of mid-OAuth-flow.
 */
export function createAbugidaAuth(options: AbugidaAuthOptions): AuthInstance {
  const env = isResolvedEnv(options.env) ? options.env : resolveAuthEnv(options.env)

  return createAuth({
    environment: env.environment,
    baseUrl: env.baseUrl,
    basePath: env.basePath,
    secret: env.secret,
    database: {
      db: options.db,
      schema: options.schema ?? (authSchema as unknown as AuthDatabaseSchema),
      provider: 'pg',
    },
    providers: env.providers,
    // One origin list for CORS and better-auth's trusted-origin check.
    cors: { origins: env.trustedOrigins, credentials: true },
    rateLimit: env.rateLimit,
    twoFactor: env.twoFactor,
    organization: env.organization,
    ...(env.tokens ? { tokens: env.tokens } : {}),
    ...(options.logger ? { logger: options.logger } : {}),
  })
}

function isResolvedEnv(value: AbugidaAuthEnv | Record<string, unknown>): value is AbugidaAuthEnv {
  return (
    typeof value === 'object' &&
    value !== null &&
    'trustedOrigins' in value &&
    Array.isArray((value as AbugidaAuthEnv).trustedOrigins)
  )
}
