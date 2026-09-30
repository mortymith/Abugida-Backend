/**
 * Auth event catalog (spec S-0.1, S-0.3, S-0.4 — *Instrumentation & acceptance*).
 *
 * The specification names an event family for every auth screen, but not every
 * screen can be instrumented the same way. Two facts about this repo shape the
 * design:
 *
 *  1. **A telemetry client already exists.** `@abugida/observability` ships an
 *     OpenTelemetry meter (`getMeter` / `createCounter` / `incrementCounter`) and
 *     the dashboard already boots it via `initObservability`. So this is a thin
 *     typed layer over a meter, not a new subsystem.
 *  2. **Audit rows and metrics answer different questions.** `audit_logs` and
 *     `security_events` record *what happened to this account*; a counter records
 *     *how often across all accounts*. IDs never go on a metric — the OTel
 *     helper warns on `user_id`/`email`/`token` for exactly this reason.
 *
 * The split enforced here: this module owns the **names and the attribute
 * domains**, `server/auth.events.server.ts` owns the **meter**. The catalog is
 * pure so a typo in an event name or an out-of-domain value is a type error at
 * the call site rather than a silently mislabelled series.
 *
 * Pure module: no React, no env, no db, no OTel. Tested by
 * `tests/auth.events.test.ts`.
 */

import type { SigninBlockedReason } from './auth.signin-state'
import type { Provider } from './auth.providers'

/** Every event name the auth screens specify. */
export const AUTH_EVENTS = {
  // S-0.1 sign-in
  signinAttempted: 'auth.signin_attempted',
  signinSucceeded: 'auth.signin_succeeded',
  signinBlocked: 'auth.signin_blocked',
  // S-0.1 invite
  inviteClaimed: 'auth.invite_claimed',
  inviteReissueRequested: 'auth.invite_reissue_requested',
  // S-0.3 MFA challenge
  mfaChallengeShown: 'auth.mfa_challenge_shown',
  lockoutRecoveryUsed: 'auth.lockout_recovery_used',
  adminResetCodeSent: 'auth.admin_reset_code_sent',
  // S-0.4 MFA enrollment
  mfaEnrollmentStarted: 'auth.mfa_enrollment_started',
  mfaEnrollmentStepCompleted: 'auth.mfa_enrollment_step_completed',
  mfaEnrollmentCompleted: 'auth.mfa_enrollment_completed',
  mfaEnrollmentAbandoned: 'auth.mfa_enrollment_abandoned',
  mfaBackupCodesShown: 'auth.mfa_backup_codes_shown',
  mfaBackupCodesRegenerated: 'auth.mfa_backup_codes_regenerated',
  mfaAuthenticatorReplaced: 'auth.mfa_authenticator_replaced',
} as const

export type AuthEventName = (typeof AUTH_EVENTS)[keyof typeof AUTH_EVENTS]

/**
 * The provider a sign-in was attempted through. The federated ids are the
 * repo's own (`auth.providers.ts`) rather than a restatement, so the metric can
 * never label a sign-in with a provider id the product does not have;
 * `mfa` is the S-0.3 challenge, which the spec counts as a sign-in attempt.
 */
export type AuthEventProvider = Provider | 'mfa'

/** The screen or affordance a sign-in attempt originated from. */
export type AuthEventSurface = 'login' | 'challenge' | 'invite_claim' | 'recovery'

/** Reasons the spec enumerates for `auth.mfa_challenge_shown{policy}`. */
export type MfaChallengePolicy = 'workspace_required' | 'user_enabled' | 'lockout'

/** How a lockout was broken. Spec S-0.3. */
export type LockoutRecoveryMethod = 'admin_reset' | 'support'

/** Where an enrollment was entered from. Spec S-0.4. */
export type EnrollmentEntryPoint = 'settings' | 'policy_prompt' | 'support_recovery' | 'replace'

/** How a backup-code set was delivered to the user. Spec S-0.4. */
export type BackupCodeChannel = 'download' | 'copy'

/**
 * S-0.3 adds its own reasons to the S-0.1 set. The sign-in screen's
 * `SigninBlockedReason` is reused rather than restated so the two cannot drift.
 */
export type AuthEventBlockedReason =
  SigninBlockedReason | 'invalid_code' | 'locked_out' | 'backup_code' | 'session_expired'

/** The value domains a single attribute may take, keyed by attribute name. */
export interface AuthAttributeDomains {
  provider: readonly AuthEventProvider[]
  surface: readonly AuthEventSurface[]
  reason: readonly AuthEventBlockedReason[]
  policy: readonly MfaChallengePolicy[]
  method: readonly LockoutRecoveryMethod[]
  entry_point: readonly EnrollmentEntryPoint[]
  step: readonly string[]
  at_step: readonly string[]
  channel: readonly BackupCodeChannel[]
  has_mfa: readonly boolean[]
}

/**
 * Attribute keys each event accepts. An event with no entry takes no attributes
 * — the spec's bare `auth.mfa_backup_codes_shown` is exactly that.
 *
 * `step3_attempts` and `invalidated_count` are absent on purpose: they are
 * numeric measurements, not labels, and belong in a histogram rather than on a
 * counter — see `AUTH_HISTOGRAMS` in the server binding.
 */
export const AUTH_EVENT_ATTRIBUTES = {
  [AUTH_EVENTS.signinAttempted]: { provider: 'provider', surface: 'surface' },
  [AUTH_EVENTS.signinSucceeded]: { provider: 'provider', has_mfa: 'has_mfa' },
  [AUTH_EVENTS.signinBlocked]: { reason: 'reason' },
  [AUTH_EVENTS.inviteClaimed]: {},
  [AUTH_EVENTS.inviteReissueRequested]: { reason: 'reason' },
  [AUTH_EVENTS.mfaChallengeShown]: { policy: 'policy' },
  [AUTH_EVENTS.lockoutRecoveryUsed]: { method: 'method' },
  [AUTH_EVENTS.adminResetCodeSent]: { channel: 'channel' },
  [AUTH_EVENTS.mfaEnrollmentStarted]: { entry_point: 'entry_point' },
  [AUTH_EVENTS.mfaEnrollmentStepCompleted]: { step: 'step' },
  [AUTH_EVENTS.mfaEnrollmentAbandoned]: { at_step: 'at_step' },
  // Spec writes both of these with no labels. `auth.mfa_backup_codes_shown` is
  // bare, and `auth.mfa_backup_codes_regenerated{invalidated_count}` carries a
  // *count* — a measurement, not an enum, so it is a histogram attribute
  // (`AUTH_HISTOGRAMS.backupCodesInvalidated`), never a label.
  [AUTH_EVENTS.mfaBackupCodesShown]: {},
  [AUTH_EVENTS.mfaBackupCodesRegenerated]: {},
  [AUTH_EVENTS.mfaEnrollmentCompleted]: {},
  [AUTH_EVENTS.mfaAuthenticatorReplaced]: {},
} as const satisfies Record<AuthEventName, Record<string, keyof AuthAttributeDomains>>

/** Attribute keys the catalog refuses, regardless of the event. */
const FORBIDDEN_ATTRIBUTES = new Set([
  'user_id',
  'email',
  'token',
  'secret',
  'ip',
  'ip_address',
  'session_id',
  'request_id',
  'invite_token',
])

export type AuthEventAttributes = Readonly<Record<string, string | number | boolean>>

/** A catalog entry resolved at runtime — `AUTH_EVENT_ATTRIBUTES` is `as const`. */
type EventSpec = Record<string, keyof AuthAttributeDomains>

function specFor(name: AuthEventName): EventSpec {
  return AUTH_EVENT_ATTRIBUTES[name]
}

const DOMAINS: AuthAttributeDomains = {
  provider: ['google', 'telegram-oidc', 'mfa'],
  surface: ['login', 'challenge', 'invite_claim', 'recovery'],
  reason: [
    'rate_limited',
    'provider_disabled',
    'unknown_account',
    'invite_mismatch',
    'invite_invalid',
    'offline',
    'session_timeout',
    'provider_error',
    'invalid_code',
    'locked_out',
    'backup_code',
    'session_expired',
  ],
  policy: ['workspace_required', 'user_enabled', 'lockout'],
  method: ['admin_reset', 'support'],
  entry_point: ['settings', 'policy_prompt', 'support_recovery', 'replace'],
  // The step machine's own vocabulary (see auth.mfa-enrollment.ts) plus the
  // challenge's. Free-form on purpose: steps are added with the machine, not
  // with a deployment, and a new step must not require touching this file.
  step: ['scan', 'confirm', 'backup_codes'],
  at_step: ['scan', 'confirm', 'backup_codes'],
  channel: ['download', 'copy'],
  has_mfa: [true, false],
}

/** The attribute domains, exported for tests and for the server binding's docs. */
export function authAttributeDomains(): AuthAttributeDomains {
  return DOMAINS
}

/**
 * Reduce caller-supplied attributes to exactly what the catalog allows.
 *
 * Three rejections, in order: a key this event does not accept, a forbidden
 * high-cardinality key, and a value outside the domain. Nothing throws —
 * instrumentation must never be able to fail a sign-in.
 */
export function sanitizeAuthAttributes(
  name: AuthEventName,
  attributes: AuthEventAttributes = {},
): Record<string, string | number | boolean> {
  const allowed = specFor(name)
  const clean: Record<string, string | number | boolean> = {}

  for (const [key, value] of Object.entries(attributes)) {
    if (!(key in allowed)) continue
    if (FORBIDDEN_ATTRIBUTES.has(key)) continue

    // `allowed` only ever holds declared domain names, so the lookup is total.
    const domain = DOMAINS[allowed[key]]
    if (!domain.includes(value as never)) continue

    clean[key] = value
  }

  return clean
}

/**
 * A stable key for a name + attribute set, so the server binding memoizes one
 * counter per distinct series instead of allocating on every call.
 */
export function authSeriesKey(name: AuthEventName, attributes: AuthEventAttributes = {}): string {
  const clean = sanitizeAuthAttributes(name, attributes)
  const parts = Object.keys(clean)
    .sort()
    .map((key) => `${key}=${String(clean[key])}`)
  return parts.length ? `${name}{${parts.join(',')}}` : name
}
