/**
 * Server-only auth instance. Never import this from route files or client code.
 * Server functions in auth.config.ts lazily import this inside their handlers.
 */
import { createAuth } from '@abugida/auth'
import { createClient } from '@abugida/database/client'
import { authSchema } from '@abugida/database/auth'
import { twoFactor } from 'better-auth/plugins/two-factor'
import { organization } from 'better-auth/plugins/organization'
import { env } from './app.config'

const db = createClient(env.DATABASE_URL)

export const auth = createAuth({
  cors: { origins: [env.WEB_APP_URL ?? env.AUTH_BASE_URL, env.AUTH_BASE_URL] },
  environment: env.ENVIRONMENT,
  baseUrl: env.AUTH_BASE_URL,
  basePath: env.AUTH_BASE_PATH,
  secret: env.BETTER_AUTH_SECRET,
  database: { db, schema: authSchema, provider: 'pg' },
  providers: {
    google:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          }
        : undefined,
    telegram:
      env.TELEGRAM_OIDC_CLIENT_ID && env.TELEGRAM_OIDC_CLIENT_SECRET
        ? {
            clientId: env.TELEGRAM_OIDC_CLIENT_ID,
            clientSecret: env.TELEGRAM_OIDC_CLIENT_SECRET,
          }
        : undefined,
  },
  additionalPlugins: [
    twoFactor({
      issuer: env.TOTP_ISSUER,
      twoFactorCookieMaxAge: env.TWO_FACTOR_COOKIE_MAX_AGE,
      trustDeviceMaxAge: env.TRUST_DEVICE_MAX_AGE,
      accountLockout: {
        maxFailedAttempts: env.ACCOUNT_LOCKOUT_MAX_ATTEMPTS,
        lockDuration: env.ACCOUNT_LOCKOUT_DURATION,
      },
    }),
    organization(),
  ],
})
