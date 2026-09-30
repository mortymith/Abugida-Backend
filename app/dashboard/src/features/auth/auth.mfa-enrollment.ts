/**
 * MFA enrollment (spec S-0.4, and the inline flow in S-6.5).
 *
 * The spec's central claim is that **the toggle does not flip until step 3
 * verifies**: "A 6-digit code is not proof the key was saved correctly; the real
 * proof is that the user's device generates the next code." This module owns the
 * step machine so that invariant is expressed once, and owns the manual-key
 * formatting so the recovery path never depends on a QR render.
 *
 * Pure module: no React, no env, no db. Tested by `tests/auth.mfa-enrollment.test.ts`.
 */

export const ENROLLMENT_STEPS = ['scan', 'confirm', 'backup_codes'] as const

export type EnrollmentStep = (typeof ENROLLMENT_STEPS)[number]

export function stepNumber(step: EnrollmentStep): number {
  return ENROLLMENT_STEPS.indexOf(step) + 1
}

/** Announced on every step change so a screen-reader user is never guessing. */
export function stepAnnouncement(step: EnrollmentStep): string {
  switch (step) {
    case 'scan':
      return `Step ${stepNumber(step)} of ${ENROLLMENT_STEPS.length}: Scan or enter the key.`
    case 'confirm':
      return `Step ${stepNumber(step)} of ${ENROLLMENT_STEPS.length}: Confirm.`
    case 'backup_codes':
      return `Your backup codes are ready.`
  }
}

/**
 * Group a base32 TOTP secret for manual entry.
 *
 * Spec S-0.4 writes the key as `XXXX-XXXX-XXXX`. That is a *grouping*, not a
 * length: a TOTP secret is 32 base32 characters, and printing only 12 of them
 * would hand the user a key that silently fails to enrol. So the secret is
 * rendered in full, in 4-character groups — the same shape the spec draws, and
 * the only form that actually works. `stripKeySeparators` is the inverse, and
 * the round-trip is asserted in the test suite.
 */
export function formatManualKey(secret: string): string {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, '')
  return clean.replace(/(.{4})(?=.)/g, '$1-')
}

export function stripKeySeparators(key: string): string {
  return key.toUpperCase().replace(/[^A-Z2-7]/g, '')
}

/** Pull the shared secret out of an `otpauth://` URI, base32-decoded not needed. */
export function extractTotpSecret(otpauthUri: string): string {
  const match = /[?&]secret=([^&]+)/.exec(otpauthUri)
  return match?.[1] ? stripKeySeparators(decodeURIComponent(match[1])) : ''
}

/** The account label an authenticator app shows next to the entry. */
export function parseOtpauthLabel(otpauthUri: string): string | null {
  const match = /[?&]issuer=([^&]+)/.exec(otpauthUri)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

export const AUTHENTICATOR_APPS = [
  { id: 'google', label: 'Google Authenticator' },
  { id: 'authy', label: 'Authy' },
  { id: 'onepassword', label: '1Password' },
  { id: 'aegis', label: 'Aegis' },
] as const

/**
 * The abandonment notice. Spec S-0.4: closing at any point leaves MFA **off**
 * and the screen has to say so — a half-enrolled state must never be implied.
 */
export function stillOffNotice(verified: boolean): string | null {
  return verified ? null : 'Two-factor is still off. Closing this page leaves it off.'
}

/**
 * Spec S-0.4: closing at any point leaves MFA off, and *no half-enrolled state
 * is persisted*. A code that fails verification never advances the machine.
 */
export function nextStep(current: EnrollmentStep, verified: boolean): EnrollmentStep {
  if (current === 'scan') return 'confirm'
  if (current === 'confirm') return verified ? 'backup_codes' : 'confirm'
  return 'backup_codes'
}

/**
 * Spec S-0.3/S-0.4: the wrong-code message and the clock-skew message are
 * distinct because the fix differs. A device more than ~60s out rejects valid
 * codes, so a user who is "typing the right code" needs to be told to fix the
 * clock, not to retype.
 */
export function verifyFailureMessage(reason: 'invalid' | 'clock_skew' | 'expired'): string {
  switch (reason) {
    case 'invalid':
      return "That code didn't work. Check that your app is on the right account and try again."
    case 'clock_skew':
      return 'Your device clock is off by more than a minute, so codes are rejected. Turn on automatic date and time.'
    case 'expired':
      return 'Codes rotate every 30 seconds — wait for the next one.'
  }
}

/**
 * Spec S-0.4 partial failure: the authenticator verified but the backup codes
 * could not be generated. The user must not be left with an account protected
 * by zero recovery codes.
 */
export function partialFailureMessage(): string {
  return "2FA is on, but your backup codes couldn't be generated. Generate them again before you close this page."
}

export const BACKUP_CODE_COUNT = 10

/** The "shown exactly once" acknowledgement copy, with the count announced. */
export function backupCodesAnnouncement(codes: readonly string[]): string {
  return `${codes.length} backup codes.`
}

/** Group codes for the `.txt` download so the file is readable offline. */
export function formatBackupCodeFile(codes: readonly string[]): string {
  const lines = [
    'Abugida Academy — two-factor backup codes',
    '',
    'Each code works once. Store this file somewhere only you can reach.',
    'Regenerating your codes invalidates every code in this list.',
    '',
    ...codes.map((code, index) => `${String(index + 1).padStart(2, '0')}.  ${code}`),
  ]
  return lines.join('\n')
}

export function backupCodesFileName(now = new Date()): string {
  return `abugida-backup-codes-${now.toISOString().slice(0, 10)}.txt`
}
