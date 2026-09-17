import { createAuth } from '@abugida/auth'
import { createClient } from '@abugida/database/client'
import { authSchema } from '@abugida/database/auth'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import type { AuthServerFunctions } from '@abugida/auth/tanstack'
import { twoFactor } from 'better-auth/plugins/two-factor'
import { organization } from 'better-auth/plugins/organization'
import { env } from './app.config'

const db = createClient(env.DATABASE_URL)

export const auth = createAuth({
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

export const getServerSession = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const result = await auth.getSession(request.headers)
  return result.ok ? result.value : null
})

export const refreshServerSession = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const result = await auth.refreshSession(request.headers)
  return result.ok ? result.value : null
})

export const signOutServer = createServerFn({ method: 'POST' }).handler(async () => {
  const request = getRequest()
  await auth.signOut(request.headers)
  return { success: true as const }
})

export const getServerAccessToken = createServerFn({ method: 'GET' })
  .validator((input: { providerId: string }) => input)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.getSession(request.headers)
    if (!session.ok) return null

    const token = await auth.getAccessToken({
      userId: session.value.user.id,
      providerId: data.providerId,
    })
    return token.ok ? token.value.accessToken : null
  })

export const authServerFns: AuthServerFunctions = {
  getServerSession,
  refreshServerSession,
  signOutServer,
  getServerAccessToken,
}
