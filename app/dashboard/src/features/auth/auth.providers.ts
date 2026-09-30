/**
 * Federated sign-in providers (spec S-0.1 Login, S-0.2 Sign-Up).
 *
 * Sign-in is Google or Telegram only — the platform stores no passwords, so
 * there is no provider list to configure at runtime and no password form to
 * keep honest. What this module owns is the three things the spec is actually
 * opinionated about, in one place so the login screen and the sign-up wizard
 * cannot drift:
 *
 *  1. the display label per provider id;
 *  2. the ordering rule — "the page remembers the provider used last and
 *     lists it first";
 *  3. the **disabled-with-a-reason** copy. Per spec 11's three-case
 *     permission rule a provider that cannot be used right now is disabled and
 *     states why (tooltip *and* `aria-describedby`) — never hidden, because a
 *     hidden button teaches a user nothing.
 *
 * Pure module: no React, no env, no db. Unit-tested directly by
 * `tests/auth.providers.test.ts`.
 */

export const PROVIDERS = ['google', 'telegram-oidc'] as const

export type Provider = (typeof PROVIDERS)[number]

/** Why a provider cannot be used right now. `null` means it can. */
export type ProviderBlock = 'unconfigured' | 'offline' | 'rate_limited'

export function providerLabel(provider: Provider): string {
  return provider === 'google' ? 'Google' : 'Telegram'
}

export function isProvider(value: unknown): value is Provider {
  return typeof value === 'string' && (PROVIDERS as readonly string[]).includes(value)
}

/**
 * Order providers for display: the one used last comes first, then the rest in
 * canonical order. `available` wins over `lastUsed` — a provider that is not
 * offered never appears just because it was used previously.
 */
export function orderProviders(
  available: readonly Provider[],
  lastUsed: Provider | null,
): Provider[] {
  if (lastUsed && available.includes(lastUsed)) {
    return [lastUsed, ...available.filter((provider) => provider !== lastUsed)]
  }
  return [...available]
}

/**
 * The sentence a user reads under a disabled provider button. Every variant
 * names the fix, per spec 11 ("an error the user can fix must state the fix").
 *
 * `retryInSeconds` is the *server*-supplied remaining window, so the countdown
 * is never a client guess.
 */
export function providerDisabledReason(input: {
  block: ProviderBlock
  provider: Provider
  retryInSeconds?: number
  otherProvider?: Provider | null
}): string {
  const label = providerLabel(input.provider)
  const alternative =
    input.otherProvider != null && input.otherProvider !== input.provider
      ? `, or use ${providerLabel(input.otherProvider)}`
      : ''

  switch (input.block) {
    case 'unconfigured':
      return `${label} sign-in is turned off for this workspace. Ask an Admin to enable it${alternative}.`
    case 'offline':
      return "You're offline. Sign-in needs a connection."
    case 'rate_limited':
      return `Too many attempts. Try again in ${formatCountdown(input.retryInSeconds ?? 0)}.`
  }
}

/**
 * Countdown phrasing used by both the provider buttons (S-0.1) and the MFA
 * lockout (S-0.3). One implementation so "4 minutes" never renders as
 * "4 minutes 0 seconds" on one screen and "04:00" on another.
 */
export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`

  const minutes = Math.ceil(seconds / 60)
  if (minutes === 1) return '1 minute'
  return `${minutes} minutes`
}

/** `4m 05s` — the ticking form. Used beside, never instead of, the sentence. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

/**
 * Spec S-0.1: the countdown is an `aria-live="polite"` region that "announces at
 * 4 minutes, 1 minute, and 30 seconds only — not every second". This returns the
 * text to announce for a given remaining count, or `null` when the tick is not a
 * milestone.
 */
export function countdownAnnouncement(totalSeconds: number): string | null {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  if (seconds === 240) return '4 minutes left before you can try again.'
  if (seconds === 60) return '1 minute left before you can try again.'
  if (seconds === 30) return '30 seconds left before you can try again.'
  return null
}
