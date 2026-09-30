/**
 * MFA challenge state (spec S-0.3).
 *
 * The existing screen counted failed attempts in React state, which meant a
 * reload cleared the counter and the 5-attempt lockout could be walked around.
 * This module is the single place the challenge state is *derived* — from
 * server-authoritative numbers — so the countdown, the remaining-attempts
 * message and the recovery affordance can never disagree with each other or
 * with the server.
 *
 * The spec's headline fix for Revision 3 is here too: **a locked-out user is
 * never a dead end**. `recoveryFor()` returns the one path that actually
 * exists for this user — request an admin reset when a second verified Admin
 * is reachable, support recovery when they are the only Admin.
 *
 * Pure module: no React, no env, no db. Tested by `tests/auth.mfa-lockout.test.ts`.
 */

/** Server-configured budget. Mirrors `ACCOUNT_LOCKOUT_MAX_ATTEMPTS` (5). */
export const MFA_MAX_ATTEMPTS = 5

/** Cooldown after the budget is spent. Mirrors `ACCOUNT_LOCKOUT_DURATION` (15 min). */
export const MFA_LOCKOUT_SECONDS = 15 * 60

export interface MfaChallengeStatus {
  /** Consecutive failed verifications, counted server-side. */
  attemptsUsed: number
  /** ISO timestamp the lock lifts, or `null` when not locked. */
  lockedUntil: string | null
  /** True when a second verified Admin exists to ask for a reset. */
  otherAdminAvailable: boolean
  /** Display name of that Admin, when known. */
  otherAdminName?: string | null
  /** The workspace has a policy requiring MFA, so enrollment is not optional. */
  policyRequired?: boolean
}

export function remainingAttempts(status: MfaChallengeStatus): number {
  return Math.max(0, MFA_MAX_ATTEMPTS - status.attemptsUsed)
}

/** Seconds left on the lock, server-authoritative, floored at 0. */
export function lockSecondsRemaining(status: MfaChallengeStatus, nowMs: number): number {
  if (!status.lockedUntil) return 0
  const until = new Date(status.lockedUntil).getTime()
  if (Number.isNaN(until)) return 0
  return Math.max(0, Math.ceil((until - nowMs) / 1000))
}

export function isLocked(status: MfaChallengeStatus, nowMs: number): boolean {
  return lockSecondsRemaining(status, nowMs) > 0
}

/** Absolute time the lock lifts, for "try again at 14:32". */
export function lockLiftsAt(status: MfaChallengeStatus): Date | null {
  if (!status.lockedUntil) return null
  const until = new Date(status.lockedUntil)
  return Number.isNaN(until.getTime()) ? null : until
}

/**
 * The one recovery path this user actually has. Spec S-0.3 criterion 1:
 * "A locked-out user with zero other Admins always sees a working path — no
 * state renders a bare 'contact your Admin'."
 */
export type MfaRecovery = 'admin_reset' | 'support' | null

export function recoveryFor(status: MfaChallengeStatus): MfaRecovery {
  return status.otherAdminAvailable ? 'admin_reset' : 'support'
}

export interface MfaNotice {
  message: string
  /** `admin_reset` / `support` when the message offers a way out. */
  recovery: MfaRecovery
  /** `alert` interrupts; `status` is announced politely. */
  tone: 'alert' | 'status' | 'warning'
}

/**
 * Copy for the challenge given where the user currently is. `offline` is
 * passed in because the spec disables the input *with a reason* rather than
 * letting the write fail.
 */
export function challengeNotice(input: {
  status: MfaChallengeStatus
  nowMs: number
  mode?: 'totp' | 'backup'
  online?: boolean
  /** Set when the last attempt failed on a 5xx — those are not counted. */
  serverError?: boolean
}): MfaNotice {
  const { status, nowMs } = input
  const online = input.online ?? true

  if (!online) {
    return {
      message: "You're offline. 2FA needs a connection.",
      recovery: null,
      tone: 'warning',
    }
  }

  if (isLocked(status, nowMs)) {
    const liftsAt = lockLiftsAt(status)
    const clock = liftsAt ? formatClockTime(liftsAt) : null
    const until = clock ? ` — try again at ${clock}.` : '.'

    if (status.otherAdminAvailable) {
      const who = status.otherAdminName ? `${status.otherAdminName} has` : 'An Admin has'
      return {
        message: `Locked for 15 minutes${until} You can also request an admin reset — ${who} been notified in-app and on Telegram.`,
        recovery: 'admin_reset',
        tone: 'alert',
      }
    }

    return {
      message: `Locked for 15 minutes${until} Open a support request to unlock 2FA for 24 hours.`,
      recovery: 'support',
      tone: 'alert',
    }
  }

  if (input.serverError) {
    return {
      message: "We couldn't check that code — nothing was consumed. Try again.",
      recovery: null,
      tone: 'alert',
    }
  }

  const left = remainingAttempts(status)

  if (left <= 2 && status.attemptsUsed > 0) {
    return {
      message: `${left} attempt${left === 1 ? '' : 's'} left before this account locks for 15 minutes.`,
      recovery: null,
      tone: 'warning',
    }
  }

  if (status.attemptsUsed > 0) {
    return {
      message:
        input.mode === 'backup'
          ? 'That backup code was not accepted. Try another one.'
          : "That code didn't work. Try again.",
      recovery: null,
      tone: 'status',
    }
  }

  return { message: '', recovery: null, tone: 'status' }
}

/**
 * The "no way out" case the spec calls out for the *only* Admin. Rendered
 * instead of the challenge body so the QR/key are never shown behind a wall.
 */
export function onlyAdminRecoveryMessage(): string {
  return "You're the only Admin in this workspace, so there's no one to ask. Open a support request to unlock 2FA for 24 hours."
}

/** `14:32` in the viewer's locale. Used by "try again at …" copy. */
export function formatClockTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/**
 * Normalise a backup code for comparison. Users copy these out of a text file
 * and paste them with spaces or in the wrong case, and the stored form is
 * `xxxxx-xxxxx`.
 */
export function normaliseBackupCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '')
}

/** Strip spaces from a pasted 6-digit code — spec S-0.3 Code Input Contract. */
export function normaliseTotpCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6)
}
