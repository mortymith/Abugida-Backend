/**
 * Login screen state (spec S-0.1).
 *
 * Two things live here, both pure:
 *
 *  1. **The callback notice.** After a federated round-trip the provider
 *     callback bounces back to `/login?error=…`. Every code it can carry is
 *     mapped to one message, one optional next action, and one analytics
 *     `blocked` reason. The spec's hard rule — "No state on this screen
 *     displays an email address" — is enforced by construction: a Telegram user
 *     may have no address at all, so every message describes the *provider
 *     identity*.
 *  2. **Which state the screen is in**, so the component is a renderer rather
 *     than a decision tree.
 *
 * Pure module: no React, no env, no db. Tested by `tests/auth.signin-state.test.ts`.
 */

/** The `auth.signin_blocked{reason}` analytics reasons the spec enumerates. */
export type SigninBlockedReason =
  | 'rate_limited'
  | 'provider_disabled'
  | 'unknown_account'
  | 'invite_mismatch'
  | 'invite_invalid'
  | 'offline'
  | 'session_timeout'
  | 'provider_error'

/** What the user can do about the notice, if anything. */
export type SigninAction =
  'create_workspace' | 'sign_in' | 'request_invite' | 'retry' | 'go_to_integrations'

export interface SigninNotice {
  message: string
  action: SigninAction | null
  blockedReason: SigninBlockedReason
}

/**
 * Map an OAuth/invite callback error code to the state S-0.1 defines for it.
 *
 * Copy follows the spec verbatim where the spec writes copy out; `null` for an
 * unrecognised code keeps the screen honest by falling back to a message that
 * still names a next action, rather than leaking a raw code to a user.
 */
export function callbackNotice(code: string | undefined | null): SigninNotice | null {
  if (!code) return null

  switch (code) {
    // Provider authenticated, but the identity is in no workspace.
    case 'unknown_account':
      return {
        message:
          "This account isn't linked to any workspace. Ask your Admin to invite you, or create a workspace.",
        action: 'create_workspace',
        blockedReason: 'unknown_account',
      }

    // Signed in with a provider identity the invitation was not issued to.
    case 'invite_mismatch':
    case 'invite_email_mismatch':
      return {
        message:
          "You signed in with an account that isn't linked to an invitation. Sign in with the account the invitation was issued to, or request a new invitation.",
        action: 'request_invite',
        blockedReason: 'invite_mismatch',
      }

    // Not found / expired / already consumed — deliberately indistinguishable,
    // so a consumed invite never reveals who consumed it.
    case 'invite_invalid':
    case 'invite_expired':
    case 'invite_consumed':
      return {
        message: 'This invitation is no longer valid. Ask for a new one — it takes a moment.',
        action: 'request_invite',
        blockedReason: 'invite_invalid',
      }

    // The pre-auth session was discarded before the round-trip completed.
    case 'session_timeout':
    case 'session_expired':
      return {
        message: 'Your sign-in took too long. Try again.',
        action: 'retry',
        blockedReason: 'session_timeout',
      }

    // The provider itself failed. Copy must reassure that the account is fine.
    case 'provider_error':
      return {
        message: "We couldn't reach your sign-in provider — your account is fine. Try again.",
        action: 'retry',
        blockedReason: 'provider_error',
      }

    default:
      return {
        message: 'Sign-in could not be completed. Try again, or use the other provider.',
        action: 'retry',
        blockedReason: 'provider_error',
      }
  }
}

/** Where a notice's action sends the user. */
export function signinActionTarget(action: SigninAction): string {
  switch (action) {
    case 'create_workspace':
      return '/signup'
    case 'sign_in':
      return '/login'
    case 'request_invite':
    case 'go_to_integrations':
      return '/settings/integrations'
    case 'retry':
      return '/login'
  }
}

/** The S-0.1 "Provider Error" copy, which names the provider that failed. */
export function providerFailureMessage(provider: 'google' | 'telegram-oidc'): string {
  const label = provider === 'google' ? 'Google' : 'Telegram'
  const other = provider === 'google' ? 'Telegram' : 'Google'
  return `${label} sign-in failed. Try again or use ${other}.`
}

/** The S-0.1 "Server error" copy, which carries a request ID. */
export function providerUnreachableMessage(
  provider: 'google' | 'telegram-oidc',
  requestId: string,
): string {
  const label = provider === 'google' ? 'Google' : 'Telegram'
  return `We couldn't reach ${label} — your account is fine. Try again. Reference: ${requestId}`
}
