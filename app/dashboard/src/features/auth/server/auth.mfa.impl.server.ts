/**
 * Server-only S-0.3 MFA challenge: server-authoritative lock state, correct
 * verification endpoints, and the recovery paths.
 *
 * The previous implementation had two defects worth naming, because both were
 * invisible in the UI:
 *
 *  - **The attempt counter lived in React state.** A reload reset it, so the
 *    5-attempt / 15-minute lockout could be walked around by refreshing. The
 *    counter is now read from the `twoFactor` row Better Auth already maintains
 *    (`failedVerificationCount`, `lockedUntil`).
 *  - **Backup codes were sent to `verifyTwoFactorOTP`** — the email/SMS OTP
 *    endpoint — so a valid backup code could never succeed. TOTP now goes to
 *    `verifyTOTP` and backup codes to `verifyBackupCode`.
 *
 * A 5xx is surfaced as `server_error` and explicitly does **not** count as a
 * failed attempt, per spec.
 *
 * Never import from client code.
 */
import { and, eq, sql } from '@abugida/database'
import { member, twoFactor, users } from '@abugida/database/auth'
import { auditLogs, notifications, supportTickets, systemConfigs } from '@abugida/database/ops'
import { db } from '#/config/db.config'
import { getAuth } from '#/config/auth.server'
import { getRequest } from '@tanstack/react-start/server'
import { clientIp, currentUserId, requestId, requireUserId } from './auth.request.server'
import type { MfaChallengeStatus } from '../auth.mfa-lockout'
import { normaliseBackupCode, normaliseTotpCode } from '../auth.mfa-lockout'

export type MfaVerifyMode = 'totp' | 'backup'

export type MfaVerifyResult =
  | { status: 'verified' }
  | { status: 'invalid_code' }
  | { status: 'locked'; lockedUntil: string; remainingSeconds: number }
  | { status: 'session_expired' }
  | { status: 'server_error'; requestId: string }

/** Call Better Auth's server API for the current request. */
async function callAuthApi<T>(method: string, body: Record<string, unknown>): Promise<T | null> {
  const request = getRequest()
  const api = getAuth().api as unknown as Record<
    string,
    (args: { body: Record<string, unknown>; headers: Headers }) => Promise<T>
  >
  const handler = api[method]
  if (typeof handler !== 'function') return null
  return await handler({ body, headers: request.headers })
}

/**
 * Resolve the challenge state from the server's own counters. Returns `null`
 * when there is no session at all — the caller renders "Your sign-in took too
 * long" rather than a challenge that can never succeed.
 */
export async function getMfaChallengeStatusImpl(): Promise<MfaChallengeStatus | null> {
  const userId = await currentUserId()
  if (!userId) return null

  const rows = await db
    .select({
      failed: twoFactor.failedVerificationCount,
      lockedUntil: twoFactor.lockedUntil,
    })
    .from(twoFactor)
    .where(eq(twoFactor.userId, userId))
    .limit(1)

  const row = rows.at(0)
  const recovery = await resolveRecoveryPath(userId)

  return {
    attemptsUsed: row?.failed ?? 0,
    lockedUntil: row?.lockedUntil ? row.lockedUntil.toISOString() : null,
    otherAdminAvailable: recovery.otherAdminAvailable,
    otherAdminName: recovery.otherAdminName,
    policyRequired: recovery.policyRequired,
  }
}

interface RecoveryPath {
  otherAdminAvailable: boolean
  otherAdminName: string | null
  policyRequired: boolean
}

/**
 * `security.policies.requireAdminMfa` (S-6.8). Read directly from
 * `system_configs` rather than through the Settings feature, so the auth
 * feature keeps no cross-feature dependency on a private helper.
 */
async function isMfaPolicyRequired(): Promise<boolean> {
  const rows = await db
    .select({ value: systemConfigs.value })
    .from(systemConfigs)
    .where(eq(systemConfigs.key, 'security.policies'))
    .limit(1)

  const stored = rows.at(0)?.value as { requireAdminMfa?: boolean } | undefined
  return stored?.requireAdminMfa === true
}

/**
 * Who, if anyone, this user can ask. Spec S-0.3: "Request an admin reset" is
 * rendered **only** when a second verified Admin exists; when they are the only
 * Admin the screen offers verified support recovery instead, so no state is a
 * dead end.
 */
async function resolveRecoveryPath(userId: string): Promise<RecoveryPath> {
  const rows = await db
    .select({ userId: member.userId, role: member.role, name: users.name })
    .from(member)
    .innerJoin(users, eq(users.id, member.userId))
    .where(
      sql`${member.userId} <> ${userId} AND (${member.role} LIKE '%admin%' OR ${member.role} LIKE '%owner%')`,
    )
    .limit(1)

  const admin = rows.at(0)
  return {
    otherAdminAvailable: Boolean(admin),
    otherAdminName: admin?.name ?? null,
    policyRequired: await isMfaPolicyRequired(),
  }
}

/**
 * Verify one code. TOTP and backup codes hit different Better Auth endpoints;
 * both clear the server-side failure counter on success, so a working code
 * always resets the budget.
 */
export async function verifyMfaChallengeImpl(input: {
  code: string
  mode: MfaVerifyMode
}): Promise<MfaVerifyResult> {
  const userId = await currentUserId()
  if (!userId) return { status: 'session_expired' }

  const code =
    input.mode === 'backup' ? normaliseBackupCode(input.code) : normaliseTotpCode(input.code)

  if (!code) return { status: 'invalid_code' }

  // Read the lock *before* verifying so a locked account short-circuits with the
  // exact server deadline rather than relying on Better Auth's error text.
  const before = await db
    .select({ lockedUntil: twoFactor.lockedUntil })
    .from(twoFactor)
    .where(eq(twoFactor.userId, userId))
    .limit(1)

  const lockedUntil = before.at(0)?.lockedUntil
  if (lockedUntil && lockedUntil.getTime() > Date.now()) {
    return {
      status: 'locked',
      lockedUntil: lockedUntil.toISOString(),
      remainingSeconds: Math.ceil((lockedUntil.getTime() - Date.now()) / 1000),
    }
  }

  const endpoint = input.mode === 'backup' ? 'verifyBackupCode' : 'verifyTOTP'

  try {
    await callAuthApi(endpoint, { code })
  } catch (cause) {
    const status = readBetterAuthStatus(cause)

    if (status === 429) {
      const after = await db
        .select({ lockedUntil: twoFactor.lockedUntil })
        .from(twoFactor)
        .where(eq(twoFactor.userId, userId))
        .limit(1)
      const until = after.at(0)?.lockedUntil ?? new Date(Date.now() + 15 * 60 * 1000)
      return {
        status: 'locked',
        lockedUntil: until.toISOString(),
        remainingSeconds: Math.max(0, Math.ceil((until.getTime() - Date.now()) / 1000)),
      }
    }

    // 401/400 are genuine rejections and are already counted by the plugin.
    if (status === 400 || status === 401) return { status: 'invalid_code' }

    // Anything else is infrastructure: not counted, retryable, with an ID.
    return { status: 'server_error', requestId: requestId() }
  }

  return { status: 'verified' }
}

function readBetterAuthStatus(cause: unknown): number | null {
  if (typeof cause !== 'object' || cause === null) return null
  const status = (cause as { status?: unknown; statusCode?: unknown }).status
  if (typeof status === 'number') return status
  const statusCode = (cause as { statusCode?: unknown }).statusCode
  return typeof statusCode === 'number' ? statusCode : null
}

/**
 * "Request an admin reset" — spec S-0.3. Writes an immutable audit row and one
 * in-app notification per reachable Admin (in-app is always on; Telegram is the
 * default secondary channel per Part 11). Re-requesting supersedes the previous
 * request, so a stale code can never be honoured.
 */
export async function requestAdminMfaResetImpl(): Promise<{
  adminName: string | null
  requestedAt: string
}> {
  const userId = await requireUserId()
  const recovery = await resolveRecoveryPath(userId)

  if (!recovery.otherAdminAvailable) {
    throw new Error('NO_REACHABLE_ADMIN')
  }

  const admins = await db
    .select({ userId: member.userId, name: users.name })
    .from(member)
    .innerJoin(users, eq(users.id, member.userId))
    .where(
      and(
        sql`${member.userId} <> ${userId}`,
        sql`(${member.role} LIKE '%admin%' OR ${member.role} LIKE '%owner%')`,
      ),
    )

  const requestedAt = new Date()

  // Supersede: one outstanding request per locked user.
  await db
    .update(notifications)
    .set({ readAt: requestedAt })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.type, 'system'),
        sql`${notifications.linkEntityType} = 'mfa_lockout'`,
        sql`${notifications.readAt} IS NULL`,
      ),
    )

  if (admins.length > 0) {
    await db.insert(notifications).values(
      admins.map((admin) => ({
        userId: admin.userId,
        type: 'system' as const,
        title: 'A teammate is locked out of two-factor',
        body: 'They asked you to reset their authenticator. Open Settings → My Profile to issue the reset.',
        linkEntityType: 'mfa_lockout',
        linkEntityPublicId: userId,
      })),
    )
  }

  await db.insert(auditLogs).values({
    actorId: userId,
    action: 'admin_action',
    resourceType: 'user_account',
    metadata: {
      screen: 'S-0.3',
      method: 'admin_reset',
      notified: admins.map((admin) => admin.userId),
      ip: clientIp(),
    },
  })

  return { adminName: recovery.otherAdminName, requestedAt: requestedAt.toISOString() }
}

/**
 * "Open a support request" — the only-Admin path (spec S-0.3). Support verifies
 * identity and opens a 24-hour window in which 2FA is bypassed; the request is
 * audit-logged with the requester and the window length.
 */
export async function requestSupportMfaRecoveryImpl(): Promise<{ publicId: string }> {
  const userId = await requireUserId()

  const rows = await db
    .insert(supportTickets)
    .values({
      userId,
      category: 'other',
      subject: 'Locked out of two-factor authentication',
      message: [
        'Request type: lockout_recovery.',
        '',
        'I am locked out of the MFA challenge for this workspace and there is no other',
        'Admin I can ask for a reset. Please verify my identity and open a 24-hour',
        'two-factor recovery window so I can enrol a new authenticator.',
      ].join('\n'),
      currentScreen: '/mfa',
      status: 'open',
    })
    .returning({ publicId: supportTickets.publicId })

  const row = rows.at(0)
  if (!row) throw new Error('Could not open the recovery request. Retry?')

  await db.insert(auditLogs).values({
    actorId: userId,
    action: 'admin_action',
    resourceType: 'user_account',
    metadata: {
      screen: 'S-0.3',
      method: 'support',
      ticket: row.publicId,
      windowHours: 24,
      ip: clientIp(),
    },
  })

  return { publicId: row.publicId }
}
