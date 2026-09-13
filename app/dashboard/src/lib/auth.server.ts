import { createAuth } from '@abugida/auth'
import { createClient } from '@abugida/database/client'
import { authSchema } from '@abugida/database/auth'
import { twoFactor } from 'better-auth/plugins/two-factor'
import { organization } from 'better-auth/plugins/organization'

const db = createClient(process.env.DATABASE_URL!)

export const auth = createAuth({
  environment:
    (process.env.ENVIRONMENT as 'development' | 'production' | 'test' | undefined) ?? 'development',
  baseUrl: process.env.AUTH_BASE_URL ?? 'http://localhost:3000',
  basePath: '/api/auth',
  secret: process.env.BETTER_AUTH_SECRET!,
  database: { db, schema: authSchema, provider: 'pg' },
  providers: {
    google: process.env.GOOGLE_CLIENT_ID
      ? {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }
      : undefined,
    telegram: process.env.TELEGRAM_OIDC_CLIENT_ID
      ? {
          clientId: process.env.TELEGRAM_OIDC_CLIENT_ID,
          clientSecret: process.env.TELEGRAM_OIDC_CLIENT_SECRET!,
        }
      : undefined,
  },
  additionalPlugins: [
    twoFactor({
      issuer: 'Abugida Academy',
      twoFactorCookieMaxAge: 600,
      trustDeviceMaxAge: 2592000,
      accountLockout: {
        maxFailedAttempts: 5,
        lockDuration: 600,
      },
    }),
    organization(),
  ],
})
