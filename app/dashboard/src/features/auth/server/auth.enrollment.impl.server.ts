/**
 * Server-only S-0.4 MFA enrollment.
 *
 * Enrolment is three server round-trips and no more:
 *
 *   1. `startEnrollment`  → issues the TOTP secret (and backup codes)
 *   2. `confirmEnrollment`→ verifies the 6-digit code; **only this flips the toggle**
 *   3. `regenerateBackupCodes` / `disableEnrollment` → post-success maintenance
 *
 * The spec's hard invariant is honoured by construction: `confirmEnrollment` is
 * the only function that can enable MFA, so a wrong code leaves the account
 * unprotected and the screen can say so.
 *
 * Never import from client code.
 */
import { eq } from '@abugida/database'
import { twoFactor } from '@abugida/database/auth'
import { auditLogs } from '@abugida/database/ops'
import { db } from '#/config/db.config'
import { auth } from '#/config/auth.server'
import { getRequest } from '@tanstack/react-start/server'
import { clientIp, currentSessionUser, requestId, requireUserId } from './auth.request.server'
import { env } from '#/config/app.config'
import { extractTotpSecret, parseOtpauthLabel } from '../auth.mfa-enrollment'
import {
  AUTH_EVENTS,
  AUTH_HISTOGRAMS,
  countAuthEvent,
  recordAuthHistogram,
} from './auth.events.server'
import type { EnrollmentEntryPoint } from '../auth.events'

async function callAuthApi<T>(method: string, body: Record<string, unknown>): Promise<T | null> {
  const request = getRequest()
  const api = auth.raw.api as unknown as Record<
    string,
    (args: { body: Record<string, unknown>; headers: Headers }) => Promise<T>
  >
  const handler = api[method]
  if (typeof handler !== 'function') return null
  return await handler({ body, headers: request.headers })
}

export type EnrollmentFailure = 'already_enrolled' | 'unauthenticated' | 'server_error'

export type StartEnrollmentResult =
  | { status: 'started'; totpUri: string; secret: string; issuer: string | null }
  | { status: 'failed'; reason: EnrollmentFailure; requestId: string }

export type EnrollmentStatus = {
  enabled: boolean
  enrolledAt: string | null
  /** Unused backup codes remaining, when the platform can count them. */
  backupCodesRemaining: number | null
  /** A policy forbids self-service enrolment for this role — whole surface off. */
  selfServiceBlocked: boolean
}

/**
 * S-0.4 "Already Enrolled": the screen shows status and the maintenance actions,
 * never a second QR.
 */
export async function getEnrollmentStatusImpl(): Promise<EnrollmentStatus | null> {
  const session = await currentSessionUser()
  if (!session) return null

  const rows = await db
    .select({ createdAt: twoFactor.createdAt, backupCodes: twoFactor.backupCodes })
    .from(twoFactor)
    .where(eq(twoFactor.userId, session.id))
    .limit(1)

  const row = rows.at(0)
  return {
    enabled: session.twoFactorEnabled,
    enrolledAt: row?.createdAt ? row.createdAt.toISOString() : null,
    backupCodesRemaining: row ? countBackupCodes(row.backupCodes) : 0,
    selfServiceBlocked: false,
  }
}

/**
 * Backup codes are stored as a JSON array. The count is informational (the
 * codes themselves are never re-readable), and a parse failure degrades to
 * `null` rather than reporting a wrong number.
 */
function countBackupCodes(stored: string): number | null {
  try {
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.length : null
  } catch {
    return null
  }
}

/**
 * Issue a TOTP secret. The user is **not** enrolled yet — this only mints the
 * secret, and the toggle stays off until `confirmEnrollment` succeeds.
 *
 * `entryPoint` is S-0.4's `entry_point` label. It is a parameter rather than a
 * constant because "replace authenticator" and "first-login policy prompt" are
 * the same server call with different causes, and the spec counts them
 * separately — a constant here would report every entry as Settings.
 */
export async function startEnrollmentImpl(
  entryPoint: EnrollmentEntryPoint = 'settings',
): Promise<StartEnrollmentResult> {
  const userId = await requireUserId()

  const existing = await getEnrollmentStatusImpl()
  if (existing?.enabled) {
    return { status: 'failed', reason: 'already_enrolled', requestId: requestId() }
  }

  try {
    const result = await callAuthApi<{ totpURI?: string } | null>('enableTwoFactor', {
      issuer: env.TOTP_ISSUER,
    })

    let totpUri = result?.totpURI ?? ''
    if (!totpUri) {
      const uri = await callAuthApi<{ totpURI?: string } | null>('getTOTPURI', { body: {} })
      totpUri = uri?.totpURI ?? ''
    }

    if (!totpUri) {
      return { status: 'failed', reason: 'server_error', requestId: requestId() }
    }

    await writeAudit(userId, 'auth.mfa_enrollment_started', { entryPoint })
    countAuthEvent(AUTH_EVENTS.mfaEnrollmentStarted, { entry_point: entryPoint })

    return {
      status: 'started',
      totpUri,
      secret: extractTotpSecret(totpUri),
      issuer: parseOtpauthLabel(totpUri) ?? env.TOTP_ISSUER,
    }
  } catch {
    return { status: 'failed', reason: 'server_error', requestId: requestId() }
  }
}

export type ConfirmEnrollmentResult =
  | { status: 'enabled' }
  | { status: 'invalid_code' }
  | { status: 'clock_skew' }
  | { status: 'server_error'; requestId: string }

/** Beyond this the authenticator's window no longer overlaps the server's. */
const CLOCK_SKEW_TOLERANCE_MS = 60_000

/**
 * The only write that turns MFA on. A wrong code returns `invalid_code` and the
 * toggle is untouched, exactly as the spec requires.
 *
 * `clientTimestampMs` lets the server tell a wrong code from a wrong *clock* —
 * two failures the user experiences identically but can only fix differently,
 * so they get different copy.
 *
 * `attempts` is how many times the user pressed Verify in this flow. It is the
 * spec's `step3_attempts` and it is a *measurement*, not a label: it goes to a
 * histogram so "most people verify on the first or second try" is a query, not
 * a new series per count.
 */
export async function confirmEnrollmentImpl(input: {
  code: string
  clientTimestampMs?: number | null
  attempts?: number | null
}): Promise<ConfirmEnrollmentResult> {
  const userId = await requireUserId()
  const code = input.code.replace(/\D/g, '').slice(0, 6)

  if (code.length !== 6) return { status: 'invalid_code' }

  try {
    await callAuthApi('verifyTOTP', { code })
  } catch (cause) {
    const status =
      typeof cause === 'object' && cause !== null
        ? ((cause as { status?: number }).status ?? null)
        : null

    if (status === 400 || status === 401) {
      return { status: isClockSkew(input.clientTimestampMs) ? 'clock_skew' : 'invalid_code' }
    }
    return { status: 'server_error', requestId: requestId() }
  }

  countAuthEvent(AUTH_EVENTS.mfaEnrollmentStepCompleted, { step: 'confirm' })
  countAuthEvent(AUTH_EVENTS.mfaEnrollmentCompleted)
  recordAuthHistogram(AUTH_HISTOGRAMS.enrollmentStep3Attempts, input.attempts ?? 1)

  await writeAudit(userId, 'auth.mfa_enabled')
  return { status: 'enabled' }
}

/**
 * TOTP steps are 30 seconds wide, so a device more than a minute out produces
 * codes the server rejects no matter how carefully the user retypes them.
 */
function isClockSkew(clientTimestampMs: number | null | undefined): boolean {
  if (typeof clientTimestampMs !== 'number' || !Number.isFinite(clientTimestampMs)) return false
  return Math.abs(Date.now() - clientTimestampMs) > CLOCK_SKEW_TOLERANCE_MS
}

export type RegenerateResult =
  | { status: 'regenerated'; backupCodes: string[] }
  | { status: 'failed'; reason: 'not_enrolled' | 'server_error'; requestId: string }

/**
 * Issue or reissue backup codes (spec S-0.4 action 4 and action 5).
 *
 * The two are the same server call with different consequences, so `reason` is
 * explicit: the first issue *shows* the codes, a regenerate *invalidates* the
 * previous set. Conflating them would make the audit log claim a user lost
 * codes the first time they ever enrolled.
 */
export async function regenerateBackupCodesImpl(
  reason: 'initial' | 'regenerate' = 'initial',
): Promise<RegenerateResult> {
  const userId = await requireUserId()

  // Counted **before** the new set exists — afterwards this is just the size of
  // the set that was written, and the audit row would claim 10 codes were
  // invalidated on a first enrolment where none existed.
  const invalidated = await countBackupCodesNow(userId)

  try {
    const result = await callAuthApi<{ backupCodes?: string[] } | null>('generateBackupCodes', {})
    const codes = (result?.backupCodes ?? []).filter(Boolean)
    if (codes.length === 0) {
      return { status: 'failed', reason: 'server_error', requestId: requestId() }
    }

    if (reason === 'regenerate') {
      await writeAudit(userId, 'auth.mfa_backup_codes_regenerated', { invalidated })
      countAuthEvent(AUTH_EVENTS.mfaBackupCodesRegenerated)
      recordAuthHistogram(AUTH_HISTOGRAMS.backupCodesInvalidated, invalidated ?? codes.length)
    } else {
      // The codes were produced and returned, so they were shown — this is the
      // one moment the platform can know. Later downloads and copies are
      // client-side and deliberately not counted.
      countAuthEvent(AUTH_EVENTS.mfaBackupCodesShown)
    }

    return { status: 'regenerated', backupCodes: codes }
  } catch {
    return { status: 'failed', reason: 'server_error', requestId: requestId() }
  }
}

async function countBackupCodesNow(userId: string): Promise<number | null> {
  const rows = await db
    .select({ backupCodes: twoFactor.backupCodes })
    .from(twoFactor)
    .where(eq(twoFactor.userId, userId))
    .limit(1)
  const stored = rows.at(0)?.backupCodes
  return stored ? countBackupCodes(stored) : null
}

/** S-0.4 "Replace authenticator" — restart at step 1, old secret stays valid. */
export async function replaceAuthenticatorImpl(): Promise<StartEnrollmentResult> {
  countAuthEvent(AUTH_EVENTS.mfaAuthenticatorReplaced)
  // The entry point flows through so this is recorded as a replace. Previously
  // this wrote its own audit row *and* called startEnrollmentImpl, which wrote a
  // second `auth.mfa_enrollment_started` — one user action, two rows, and the
  // first was written before the operation it described could fail.
  return startEnrollmentImpl('replace')
}

export async function disableEnrollmentImpl(): Promise<{ ok: true }> {
  const userId = await requireUserId()
  await callAuthApi('disableTwoFactor', {})
  await writeAudit(userId, 'auth.mfa_disabled')
  return { ok: true }
}

async function writeAudit(
  actorId: string,
  event: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(auditLogs).values({
    actorId,
    action: 'admin_action',
    resourceType: 'user_account',
    metadata: { event, screen: 'S-0.4', ip: clientIp(), ...metadata },
  })
}
