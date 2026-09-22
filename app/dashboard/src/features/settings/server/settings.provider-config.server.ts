/**
 * Server-only provider availability summary for S-6.3/S-6.8. Reports which
 * sign-in providers are configured at the server (env presence) — booleans
 * only, never client ids or secrets.
 */
import { env } from '#/config/app.config'

export function authServerConfigSummary(): Array<{
  provider: 'google' | 'telegram'
  configured: boolean
}> {
  return [
    {
      provider: 'google',
      configured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    },
    {
      provider: 'telegram',
      configured: Boolean(env.TELEGRAM_OIDC_CLIENT_ID && env.TELEGRAM_OIDC_CLIENT_SECRET),
    },
  ]
}
