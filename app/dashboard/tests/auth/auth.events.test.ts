import { describe, expect, test } from 'bun:test'
import {
  AUTH_EVENT_ATTRIBUTES,
  AUTH_EVENTS,
  authAttributeDomains,
  authSeriesKey,
  sanitizeAuthAttributes,
} from '#/features/auth/auth.events'
import type { AuthEventName } from '#/features/auth/auth.events'

/**
 * The auth event catalog.
 *
 * The acceptance criterion these tests exist for is the one that keeps a
 * counter honest: a series is only as good as the names and domains behind it.
 * A typo in an event name must be a type error, and a high-cardinality or
 * out-of-domain attribute must never reach the exporter — an unvalidated label
 * silently forks a series and nobody notices until the dashboard is wrong.
 */

describe('catalog', () => {
  test('covers every event the spec names for S-0.1, S-0.3 and S-0.4', () => {
    // S-0.1
    for (const name of ['auth.signin_attempted', 'auth.signin_succeeded', 'auth.signin_blocked']) {
      expect(Object.values(AUTH_EVENTS)).toContain(name as AuthEventName)
    }
    // S-0.1 invite
    expect(Object.values(AUTH_EVENTS)).toContain('auth.invite_reissue_requested')
    // S-0.3
    for (const name of [
      'auth.mfa_challenge_shown',
      'auth.lockout_recovery_used',
      'auth.admin_reset_code_sent',
    ]) {
      expect(Object.values(AUTH_EVENTS)).toContain(name as AuthEventName)
    }
    // S-0.4
    for (const name of [
      'auth.mfa_enrollment_started',
      'auth.mfa_enrollment_step_completed',
      'auth.mfa_enrollment_completed',
      'auth.mfa_enrollment_abandoned',
      'auth.mfa_backup_codes_shown',
      'auth.mfa_backup_codes_regenerated',
      'auth.mfa_authenticator_replaced',
    ]) {
      expect(Object.values(AUTH_EVENTS)).toContain(name as AuthEventName)
    }
  })

  test('every event has an attribute entry, so an unknown name cannot ship', () => {
    for (const name of Object.values(AUTH_EVENTS)) {
      expect(AUTH_EVENT_ATTRIBUTES[name]).toBeDefined()
    }
  })

  test('no event accepts an identifier as a label', () => {
    for (const [name, attributes] of Object.entries(AUTH_EVENT_ATTRIBUTES)) {
      for (const key of Object.keys(attributes)) {
        expect(['user_id', 'email', 'token', 'ip', 'session_id']).not.toContain(key)
      }
      expect(name).toBeTruthy()
    }
  })

  test('the step vocabulary matches the enrollment step machine', () => {
    const domains = authAttributeDomains()
    expect(domains.step).toEqual(['scan', 'confirm', 'backup_codes'])
    expect(domains.at_step).toEqual(['scan', 'confirm', 'backup_codes'])
  })
})

describe('sanitizeAuthAttributes', () => {
  test('keeps a declared attribute with an in-domain value', () => {
    expect(
      sanitizeAuthAttributes(AUTH_EVENTS.signinAttempted, {
        provider: 'telegram-oidc',
        surface: 'login',
      }),
    ).toEqual({ provider: 'telegram-oidc', surface: 'login' })
  })

  test('drops a value outside the domain rather than exporting a new series', () => {
    expect(
      sanitizeAuthAttributes(AUTH_EVENTS.signinAttempted, {
        provider: 'telegram' as never,
        surface: 'login',
      }),
    ).toEqual({ surface: 'login' })
  })

  test('drops an attribute the event does not accept', () => {
    // `signin_blocked` is keyed by reason only — a provider on it would fork
    // the series into a shape the dashboard does not read.
    expect(
      sanitizeAuthAttributes(AUTH_EVENTS.signinBlocked, {
        reason: 'rate_limited',
        provider: 'google',
      }),
    ).toEqual({ reason: 'rate_limited' })
  })

  test('never lets an identifier through, even under an accepted name', () => {
    expect(
      sanitizeAuthAttributes(AUTH_EVENTS.signinAttempted, {
        provider: 'google',
        user_id: 'usr_123',
        email: 'someone@example.com',
        token: 'Abugida-2026',
        ip: '10.0.0.1',
      }),
    ).toEqual({ provider: 'google' })
  })

  test('an event with no attributes takes none', () => {
    // The spec writes these three bare. In particular
    // `auth.mfa_backup_codes_regenerated` carries `invalidated_count`, which is
    // a histogram measurement rather than a label — attaching it here would
    // fork the series by how many codes happened to be invalidated.
    for (const name of [
      AUTH_EVENTS.mfaBackupCodesShown,
      AUTH_EVENTS.mfaBackupCodesRegenerated,
      AUTH_EVENTS.mfaEnrollmentCompleted,
      AUTH_EVENTS.mfaAuthenticatorReplaced,
    ] as const) {
      expect(sanitizeAuthAttributes(name, { step: 'confirm', channel: 'copy' })).toEqual({})
    }
  })

  test('tolerates a missing or empty attribute set', () => {
    expect(sanitizeAuthAttributes(AUTH_EVENTS.signinBlocked)).toEqual({})
  })
})

describe('authSeriesKey', () => {
  test('is stable regardless of key order', () => {
    const a = authSeriesKey(AUTH_EVENTS.signinAttempted, { provider: 'google', surface: 'login' })
    const b = authSeriesKey(AUTH_EVENTS.signinAttempted, { surface: 'login', provider: 'google' })
    expect(a).toBe(b)
    expect(
      authSeriesKey(AUTH_EVENTS.signinAttempted, { provider: 'google', surface: 'login' }),
    ).toBe('auth.signin_attempted{provider=google,surface=login}')
  })

  test('a bare event is keyed by its name alone', () => {
    expect(authSeriesKey(AUTH_EVENTS.mfaAuthenticatorReplaced)).toBe(
      'auth.mfa_authenticator_replaced',
    )
  })

  test('sanitized-away attributes do not fork the series', () => {
    // An out-of-domain value and its absence must produce one series, not two.
    expect(authSeriesKey(AUTH_EVENTS.signinBlocked, { reason: 'nope' as never })).toBe(
      authSeriesKey(AUTH_EVENTS.signinBlocked),
    )
  })

  test('different values are different series', () => {
    expect(authSeriesKey(AUTH_EVENTS.mfaEnrollmentStarted, { entry_point: 'settings' })).not.toBe(
      authSeriesKey(AUTH_EVENTS.mfaEnrollmentStarted, { entry_point: 'policy_prompt' }),
    )
  })
})
