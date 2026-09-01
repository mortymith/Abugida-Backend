/**
 * @module auth
 *
 * API-specific authentication composition on top of the shared `@abugida/auth`
 * package (Better Auth). Builds the provider registry (Google + Apple ID) and
 * the validated Better Auth configuration from `app_config`.
 *
 * Direction:
 *   app_config → database → auth
 *
 * Secrets are never hard-coded here — `BETTER_AUTH_SECRET` and all OAuth
 * credentials come from `appConfig`. `createAuthInstance()` is lazy so callers
 * can initialize observability before the logger is first used.
 */

import { createAuth, parseEnvironment, type AuthConfig, type AuthInstance } from '@abugida/auth'
import { authSchema } from '@abugida/database/auth'
import { appConfig } from './app_config'
import { db } from './database'
import { logger } from './observability'

function buildProviders(): AuthConfig['providers'] {
  const providers: AuthConfig['providers'] = {}

  if (appConfig.GOOGLE_CLIENT_ID && appConfig.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: appConfig.GOOGLE_CLIENT_ID,
      clientSecret: appConfig.GOOGLE_CLIENT_SECRET,
    }
  }

  if (
    appConfig.APPLE_CLIENT_ID &&
    appConfig.APPLE_TEAM_ID &&
    appConfig.APPLE_KEY_ID &&
    appConfig.APPLE_PRIVATE_KEY
  ) {
    providers.apple = {
      clientId: appConfig.APPLE_CLIENT_ID,
      teamId: appConfig.APPLE_TEAM_ID,
      keyId: appConfig.APPLE_KEY_ID,
      privateKey: appConfig.APPLE_PRIVATE_KEY,
    }
  }

  return providers
}

function buildTokenOptions(): Pick<AuthConfig, 'tokens'> | Record<string, never> {
  const issuer = appConfig.AUTH_BASE_URL
  const audience = appConfig.TOKEN_AUDIENCE
  if (!issuer && !audience) return {}
  return {
    tokens: {
      ...(issuer ? { issuer } : {}),
      ...(audience ? { audience } : {}),
    },
  }
}

/**
 * The resolved Better Auth configuration. Kept as a plain object so it can be
 * inspected/tested independently of the live auth instance.
 */
export const authConfig: AuthConfig = {
  environment: parseEnvironment(appConfig.NODE_ENV),
  baseUrl: appConfig.BETTER_AUTH_URL,
  secret: appConfig.BETTER_AUTH_SECRET,
  database: { db, schema: authSchema, provider: 'pg' },
  providers: buildProviders(),
  ...(appConfig.corsOrigins.length > 0
    ? { cors: { origins: appConfig.corsOrigins, credentials: true } }
    : {}),
  rateLimit: {
    max: appConfig.AUTH_RATE_LIMIT_MAX,
    windowSeconds: appConfig.AUTH_RATE_LIMIT_WINDOW_SECONDS,
  },
  ...buildTokenOptions(),
}

/**
 * Create the shared auth instance. Call after observability is initialized so
 * the shared logger is available. Fails fast if no OAuth provider is
 * configured — the shared package requires at least one.
 */
export function createAuthInstance(): AuthInstance {
  return createAuth({ ...authConfig, logger })
}
