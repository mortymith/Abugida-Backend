import { describe, expect, test } from 'bun:test'
import {
  PROVIDERS,
  countdownAnnouncement,
  formatClock,
  formatCountdown,
  isProvider,
  orderProviders,
  providerDisabledReason,
  providerLabel,
} from '#/features/auth/auth.providers'

/** S-0.1 provider catalogue, ordering and the "disabled with a reason" contract. */

describe('provider catalogue', () => {
  test('is Google and Telegram only — the platform stores no passwords', () => {
    expect(PROVIDERS).toEqual(['google', 'telegram-oidc'])
  })

  test('labels each provider', () => {
    expect(providerLabel('google')).toBe('Google')
    expect(providerLabel('telegram-oidc')).toBe('Telegram')
  })

  test('rejects anything that is not a known provider id', () => {
    expect(isProvider('google')).toBe(true)
    expect(isProvider('telegram-oidc')).toBe(true)
    expect(isProvider('password')).toBe(false)
    expect(isProvider(null)).toBe(false)
  })
})

describe('orderProviders', () => {
  test('lists the provider used last first (spec S-0.1 default state)', () => {
    expect(orderProviders(['google', 'telegram-oidc'], 'telegram-oidc')).toEqual([
      'telegram-oidc',
      'google',
    ])
  })

  test('falls back to the given order when nothing was used last', () => {
    expect(orderProviders(['google', 'telegram-oidc'], null)).toEqual(['google', 'telegram-oidc'])
  })

  test('never promotes a provider that is not available', () => {
    // The ordering rule must not resurrect a disabled provider.
    expect(orderProviders(['google'], 'telegram-oidc')).toEqual(['google'])
  })
})

describe('providerDisabledReason', () => {
  test('never hides a disabled provider — it explains and offers the alternative', () => {
    const reason = providerDisabledReason({
      block: 'unconfigured',
      provider: 'google',
      otherProvider: 'telegram-oidc',
    })
    expect(reason).toContain('turned off for this workspace')
    expect(reason).toContain('Telegram')
    expect(reason).toContain('Ask an Admin')
  })

  test('omits the alternative when there is not one', () => {
    const reason = providerDisabledReason({ block: 'unconfigured', provider: 'google' })
    expect(reason).not.toContain('or use')
  })

  test('offline states the reason rather than failing silently', () => {
    expect(providerDisabledReason({ block: 'offline', provider: 'google' })).toBe(
      "You're offline. Sign-in needs a connection.",
    )
  })

  test('rate limited names the wait', () => {
    const reason = providerDisabledReason({
      block: 'rate_limited',
      provider: 'google',
      retryInSeconds: 240,
    })
    expect(reason).toBe('Too many attempts. Try again in 4 minutes.')
  })
})

describe('countdown phrasing', () => {
  test('never renders a zero-value segment', () => {
    expect(formatCountdown(240)).toBe('4 minutes')
    expect(formatCountdown(60)).toBe('1 minute')
    expect(formatCountdown(45)).toBe('45 seconds')
    expect(formatCountdown(1)).toBe('1 second')
    expect(formatCountdown(0)).toBe('0 seconds')
    expect(formatCountdown(-10)).toBe('0 seconds')
  })

  test('rounds partial minutes up, matching the server deadline', () => {
    expect(formatCountdown(61)).toBe('2 minutes')
    expect(formatCountdown(59)).toBe('59 seconds')
  })

  test('clock form is zero-padded', () => {
    expect(formatClock(245)).toBe('4:05')
    expect(formatClock(59)).toBe('0:59')
  })
})

describe('countdownAnnouncement', () => {
  test('announces only at the 4-minute, 1-minute and 30-second milestones', () => {
    // Spec S-0.1: "announces at 4 minutes, 1 minute, and 30 seconds only —
    // not every second."
    expect(countdownAnnouncement(240)).not.toBeNull()
    expect(countdownAnnouncement(60)).not.toBeNull()
    expect(countdownAnnouncement(30)).not.toBeNull()
  })

  test('stays silent on every other tick', () => {
    for (const seconds of [241, 239, 200, 61, 59, 31, 29, 1, 0]) {
      expect(countdownAnnouncement(seconds)).toBeNull()
    }
  })
})
