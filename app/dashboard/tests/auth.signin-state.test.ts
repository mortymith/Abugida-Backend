import { describe, expect, test } from 'bun:test'
import {
  callbackNotice,
  providerFailureMessage,
  providerUnreachableMessage,
  signinActionTarget,
} from '#/features/auth/auth.signin-state'

/**
 * S-0.1 callback states.
 *
 * The acceptance criterion these tests exist for: **"No state on this screen
 * displays an email address."** A Telegram user may have none, so every message
 * describes the provider identity instead.
 */

const CODES = [
  'unknown_account',
  'invite_mismatch',
  'invite_email_mismatch',
  'invite_invalid',
  'invite_expired',
  'invite_consumed',
  'session_timeout',
  'session_expired',
  'provider_error',
  'something_unmapped',
] as const

describe('callbackNotice', () => {
  test('returns nothing when the callback carried no error', () => {
    expect(callbackNotice(undefined)).toBeNull()
    expect(callbackNotice(null)).toBeNull()
    expect(callbackNotice('')).toBeNull()
  })

  test('every code produces a message that names a next action', () => {
    for (const code of CODES) {
      const notice = callbackNotice(code)
      expect(notice).not.toBeNull()
      expect(notice!.message.length).toBeGreaterThan(10)
      expect(notice!.action).not.toBeNull()
    }
  })

  test('no message names an email address', () => {
    for (const code of CODES) {
      expect(callbackNotice(code)!.message).not.toMatch(/email|e-mail|@/i)
    }
  })

  test('an unlinked identity offers both ways forward', () => {
    const notice = callbackNotice('unknown_account')!
    expect(notice.blockedReason).toBe('unknown_account')
    expect(notice.action).toBe('create_workspace')
    expect(notice.message).toContain('create a workspace')
  })

  test('an invite mismatch describes the provider identity, not the address', () => {
    const notice = callbackNotice('invite_mismatch')!
    expect(notice.message).toContain("isn't linked to an invitation")
    expect(notice.action).toBe('request_invite')
  })

  test('the legacy invite_email_mismatch code maps to the same state', () => {
    expect(callbackNotice('invite_email_mismatch')!.blockedReason).toBe(
      callbackNotice('invite_mismatch')!.blockedReason,
    )
  })

  test('not-found, expired and consumed are deliberately indistinguishable', () => {
    // A consumed invite must never reveal who consumed it.
    const messages = ['invite_invalid', 'invite_expired', 'invite_consumed'].map(
      (code) => callbackNotice(code)!.message,
    )
    expect(new Set(messages).size).toBe(1)
    expect(messages[0]).toContain('no longer valid')
  })

  test('an expired pre-auth session says so and offers a retry', () => {
    const notice = callbackNotice('session_timeout')!
    expect(notice.message).toBe('Your sign-in took too long. Try again.')
    expect(notice.action).toBe('retry')
  })

  test('an unrecognised code still yields actionable copy, never a raw code', () => {
    const notice = callbackNotice('http_500_from_upstream')!
    expect(notice.message).not.toContain('http_500_from_upstream')
    expect(notice.action).toBe('retry')
  })
})

describe('signinActionTarget', () => {
  test('every action resolves to an in-app route', () => {
    for (const action of [
      'create_workspace',
      'sign_in',
      'request_invite',
      'retry',
      'go_to_integrations',
    ] as const) {
      const target = signinActionTarget(action)
      expect(target.startsWith('/')).toBe(true)
      expect(target).not.toContain('//')
    }
  })
})

describe('provider failure copy', () => {
  test('names the other provider so the user has somewhere to go', () => {
    expect(providerFailureMessage('google')).toBe(
      'Google sign-in failed. Try again or use Telegram.',
    )
    expect(providerFailureMessage('telegram-oidc')).toBe(
      'Telegram sign-in failed. Try again or use Google.',
    )
  })

  test('an unreachable provider reassures that the account is fine, and cites a reference', () => {
    const message = providerUnreachableMessage('google', 'AB12CD34')
    expect(message).toContain('your account is fine')
    expect(message).toContain('AB12CD34')
  })
})
