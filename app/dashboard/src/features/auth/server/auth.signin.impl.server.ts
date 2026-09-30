/**
 * Server-only S-0.1 sign-in support: which providers this workspace offers,
 * per-provider throttling, and the `login_events` trail.
 *
 * Provider availability is a server fact (it is read from env, not the DOM), so
 * the login screen renders "disabled with a reason" from this response rather
 * than guessing in the browser.
 *
 * Throttling is recorded in `security_events` — the table that already owns
 * `failed_login` and `rate_limit_exceeded` — so the countdown the UI shows is
 * derived from rows the platform already writes, with no second rate-limit
 * store to keep in sync. Enforcement itself stays with Better Auth's rate
 * limiter; this only makes the block *visible and server-authoritative*.
 *
 * Never import from client code.
 */
import { and, eq, gte, sql } from '@abugida/database'
import { securityEvents } from '@abugida/database/ops'
import { db } from '#/config/db.config'
import { env } from '#/config/app.config'
import { logger } from '#/config/observability.config'
import { countAuthEvent, AUTH_EVENTS } from './auth.events.server'
import type { AuthEventSurface } from '../auth.events'
import { clientIp, requestId } from './auth.request.server'
import type { Provider } from '../auth.providers'
import { PROVIDERS } from '../auth.providers'

/** Attempts per provider before that provider is throttled. Spec S-0.1. */
const MAX_ATTEMPTS = 5
/** Length of the throttle window. */
const WINDOW_SECONDS = 15 * 60

export interface ProviderAvailability {
  provider: Provider
  /** False when the workspace has not configured this provider at all. */
  enabled: boolean
  /** Epoch ms until which this provider is throttled; 0 when it is not. */
  retryAt: number
}

export interface SigninAvailability {
  providers: ProviderAvailability[]
  requestId: string
}

/** Providers this deployment actually offers, in canonical order. */
export function configuredProviders(): Provider[] {
  return PROVIDERS.filter((provider) => {
    if (provider === 'google') return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
    return Boolean(env.TELEGRAM_OIDC_CLIENT_ID && env.TELEGRAM_OIDC_CLIENT_SECRET)
  })
}

async function throttledUntil(provider: Provider): Promise<number> {
  const ip = clientIp()
  if (!ip) return 0

  const windowStart = new Date(Date.now() - WINDOW_SECONDS * 1000)
  const rows = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(securityEvents)
    .where(
      and(
        eq(securityEvents.eventType, 'failed_login'),
        eq(securityEvents.actorIp, ip),
        gte(securityEvents.createdAt, windowStart),
        sql`${securityEvents.metadata}->>'provider' = ${provider}`,
      ),
    )

  const attempts = Number(rows.at(0)?.total ?? 0)
  if (attempts < MAX_ATTEMPTS) return 0

  // The window is anchored on the oldest failure still inside it, so the
  // countdown always agrees with when the block actually lifts.
  const oldest = await db
    .select({ createdAt: securityEvents.createdAt })
    .from(securityEvents)
    .where(
      and(
        eq(securityEvents.eventType, 'failed_login'),
        eq(securityEvents.actorIp, ip),
        gte(securityEvents.createdAt, windowStart),
        sql`${securityEvents.metadata}->>'provider' = ${provider}`,
      ),
    )
    .orderBy(sql`${securityEvents.createdAt} asc`)
    .limit(1)

  const first = oldest.at(0)?.createdAt
  if (!first) return 0
  return first.getTime() + WINDOW_SECONDS * 1000
}

export async function getSigninAvailabilityImpl(): Promise<SigninAvailability> {
  const configured = configuredProviders()

  const providers = await Promise.all(
    PROVIDERS.map(async (provider) => {
      if (!configured.includes(provider)) {
        return { provider, enabled: false, retryAt: 0 }
      }
      const retryAt = await throttledUntil(provider)
      return { provider, enabled: true, retryAt }
    }),
  )

  return { providers, requestId: requestId() }
}

export type SigninOutcome =
  | 'succeeded'
  | 'provider_error'
  | 'provider_cancelled'
  | 'unknown_account'
  | 'invite_mismatch'
  | 'invite_invalid'

/**
 * Append to the sign-in trail. Failures are what the throttle counts, so this
 * is deliberately the only writer of `failed_login` rows.
 */
export async function recordSigninOutcomeImpl(input: {
  provider: Provider
  outcome: SigninOutcome
  inviteToken?: string | null
  /** Which affordance the attempt came from. S-0.1 counts the challenge too. */
  surface?: AuthEventSurface
  /** Whether MFA was on for the account, for `auth.signin_succeeded`. */
  hasMfa?: boolean
}): Promise<void> {
  const context = {
    event: `auth.signin_${input.outcome}`,
    provider: input.provider,
    ip: clientIp(),
    requestId: requestId(),
    inviteToken: input.inviteToken ?? null,
  }

  // S-0.1 acceptance: "a provider disabled for the workspace ... its
  // `auth.signin_attempted` never fires". The button is rendered disabled, so a
  // report arriving here for an unconfigured provider is either a stale tab or
  // a crafted call — neither is an attempt worth counting.
  if (configuredProviders().includes(input.provider)) {
    countAuthEvent(AUTH_EVENTS.signinAttempted, {
      provider: input.provider,
      surface: input.surface ?? 'login',
    })
  }

  if (input.outcome === 'succeeded') {
    countAuthEvent(AUTH_EVENTS.signinSucceeded, {
      provider: input.provider,
      has_mfa: input.hasMfa ?? false,
    })
    logger.info(context, 'auth signin')
    return
  }

  logger.warn(context, 'auth signin')

  // A cancellation is the user changing their mind, not a blocked sign-in.
  if (input.outcome === 'provider_cancelled') return

  countAuthEvent(AUTH_EVENTS.signinBlocked, { reason: input.outcome })

  await db.insert(securityEvents).values({
    eventType: 'failed_login',
    actorIp: clientIp(),
    severity: 'warning',
    description: `auth.signin_${input.outcome}`,
    metadata: { provider: input.provider, requestId: context.requestId },
  })
}

export { MAX_ATTEMPTS as SIGNIN_MAX_ATTEMPTS, WINDOW_SECONDS as SIGNIN_WINDOW_SECONDS }
