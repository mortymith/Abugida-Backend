import { createServerFn } from '@tanstack/react-start'

/**
 * Client-safe S-0.1 sign-in server functions. Impls are dynamically imported so
 * server-only code (env, db, the auth instance) never enters the client bundle.
 */
export const getSigninAvailability = createServerFn({ method: 'GET' }).handler(async () => {
  const { getSigninAvailabilityImpl } = await import('./auth.signin.impl.server')
  return getSigninAvailabilityImpl()
})

export const recordSigninOutcome = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      provider: 'google' | 'telegram-oidc'
      outcome:
        | 'succeeded'
        | 'provider_error'
        | 'provider_cancelled'
        | 'unknown_account'
        | 'invite_mismatch'
        | 'invite_invalid'
      inviteToken?: string | null
      /** Which affordance the attempt came from; S-0.1 counts the challenge. */
      surface?: 'login' | 'challenge' | 'invite_claim' | 'recovery'
      /** Whether MFA was on for the account, for `auth.signin_succeeded`. */
      hasMfa?: boolean
    }) => input,
  )
  .handler(async ({ data }) => {
    const { recordSigninOutcomeImpl } = await import('./auth.signin.impl.server')
    return recordSigninOutcomeImpl(data)
  })

export const claimInvite = createServerFn({ method: 'POST' })
  .validator(
    (input: { token?: string | null; code?: string | null; providerAccountId?: string | null }) =>
      input,
  )
  .handler(async ({ data }) => {
    const { claimInviteImpl } = await import('./auth.invite-claim.impl.server')
    return claimInviteImpl(data)
  })

/**
 * Redeem the ticket a pre-signin claim returned. Called once the provider
 * redirect has produced a session, and it is the write that actually consumes
 * the invite.
 */
export const completeInviteClaim = createServerFn({ method: 'POST' })
  .validator((input: { ticket: string }) => input)
  .handler(async ({ data }) => {
    const { completeInviteClaimImpl } = await import('./auth.invite-claim.impl.server')
    return completeInviteClaimImpl(data)
  })

/** Issue a claimable invite for a workspace. Storage for GAP-2. */
export const issueInviteLink = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      organizationId: string
      role?: string | null
      email?: string | null
      handle?: string | null
    }) => input,
  )
  .handler(async ({ data }) => {
    const { issueInviteLinkImpl } = await import('./auth.invite-claim.impl.server')
    return issueInviteLinkImpl(data)
  })
