/**
 * Server-only implementation of S-6.5 My Profile & Account. Profile identity
 * writes go through the Better Auth server API (`updateUser`,
 * `changePassword`, two-factor, session, and account endpoints) so cookie
 * handling, verification, and audit stay inside the existing auth layer.
 * Preferences persist in the app-owned `user_profiles` row. Never import
 * from client code.
 */
import { eq } from '@abugida/database'
import { member, userProfiles } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import { auth } from '#/config/auth.server'
import { getRequest } from '@tanstack/react-start/server'
import { createStorage, configFromEnv, hasEnvConfig } from '@abugida/storage'
import { requireProfileUser } from './settings.server-helpers.server'
import { authServerConfigSummary } from './settings.provider-config.server'
import type {
  ConnectedAccountItem,
  MfaEnrollment,
  ProfileSecurityPage,
  ProfileSummary,
} from '../settings.types'
import type {
  AvatarUploadInput,
  DisableTotpInput,
  UnlinkAccountInput,
  UpdateProfileInput,
  VerifyTotpInput,
} from '../schemas/settings.schema'

const UPLOAD_TTL_SECONDS = 900
const READ_TTL_SECONDS = 3600

interface SessionValue {
  user: {
    id: string
    name: string | null
    email: string | null
    emailVerified?: boolean
    image?: string | null
    twoFactorEnabled?: boolean
  }
  session: {
    token: string
    expiresAt: Date
    ipAddress?: string | null
    userAgent?: string | null
    createdAt?: Date
  }
}

async function getSessionValue(): Promise<{ userId: string; value: SessionValue }> {
  const userId = await requireProfileUser()
  const request = getRequest()
  const session = await auth.getSession(request.headers)
  if (!session.ok) throw new Error('UNAUTHORIZED')
  return { userId, value: session.value as unknown as SessionValue }
}

async function callAuthApi<T>(
  endpoint: string,
  args: { body?: Record<string, unknown>; query?: Record<string, unknown> } = {},
): Promise<T> {
  const request = getRequest()
  const api = auth.raw.api as unknown as Record<
    string,
    (args: {
      headers: Headers
      body?: Record<string, unknown>
      query?: Record<string, unknown>
    }) => Promise<T>
  >
  return api[endpoint]({ headers: request.headers, body: args.body, query: args.query })
}

async function readAvatarUrl(objectKey: string | null): Promise<string | null> {
  if (!objectKey || !hasEnvConfig()) return null
  try {
    const storage = createStorage(configFromEnv())
    const presigned = await storage.presignedDownload(objectKey, { expiresIn: READ_TTL_SECONDS })
    return presigned.url
  } catch {
    return null
  }
}

export async function getProfileImpl(): Promise<ProfileSummary> {
  const { userId, value } = await getSessionValue()

  const rows = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1)
  const profile = rows.at(0)

  // Single lightweight query for the read-only role chip (spec S-6.5).
  const roleRows = await db
    .select({ role: member.role })
    .from(member)
    .where(eq(member.userId, userId))
    .limit(1)
  const rawRole = roleRows.at(0)?.role ?? null

  const avatarUrl = await readAvatarUrl(profile?.avatarObjectKey ?? null)

  return {
    userId,
    name: value.user.name,
    email: value.user.email,
    emailVerified: value.user.emailVerified === true,
    role: rawRole ?? 'viewer',
    image: value.user.image ?? null,
    avatarObjectKey: profile?.avatarObjectKey ?? null,
    avatarUrl,
    languagePreference: profile?.languagePreference ?? 'en',
    timezone: profile?.timezone ?? 'Africa/Addis_Ababa',
    availability: 'ok',
  }
}

export async function updateProfileImpl(input: UpdateProfileInput): Promise<{ ok: true }> {
  const { userId } = await getSessionValue()

  // Name is Better Auth-owned: persist through the auth API, not direct SQL.
  await callAuthApi('updateUser', { body: { name: input.name } })

  // Preferences are app-owned (user_profiles). Upsert keeps the row single.
  await db
    .insert(userProfiles)
    .values({
      userId,
      languagePreference: input.languagePreference,
      timezone: input.timezone,
    })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        languagePreference: input.languagePreference,
        timezone: input.timezone,
        updatedAt: new Date(),
      },
    })

  return { ok: true }
}

const AVATAR_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export async function getAvatarUploadUrlImpl(
  input: AvatarUploadInput,
): Promise<{ objectKey: string; uploadUrl: string; expiresIn: number }> {
  await requireProfileUser()

  const extension = AVATAR_TYPES[input.contentType]
  if (!extension) throw new Error('UNSUPPORTED_MEDIA_TYPE: use PNG, JPEG, WebP, or GIF')

  if (!hasEnvConfig()) {
    throw new Error(
      'STORAGE_NOT_CONFIGURED: set STORAGE_* env vars to enable avatar uploads (see .env.example)',
    )
  }
  const objectKey = `avatars/${globalThis.crypto.randomUUID()}.${extension}`
  const storage = createStorage(configFromEnv())
  const presigned = await storage.presignedUpload(objectKey, {
    expiresIn: UPLOAD_TTL_SECONDS,
    contentType: input.contentType,
  })
  return { objectKey, uploadUrl: presigned.url, expiresIn: UPLOAD_TTL_SECONDS }
}

export async function markAvatarUploadedImpl(objectKey: string): Promise<{ ok: true }> {
  const { userId } = await getSessionValue()
  if (!objectKey.startsWith('avatars/')) throw new Error('FORBIDDEN_KEY')

  await db
    .insert(userProfiles)
    .values({ userId, avatarObjectKey: objectKey })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: { avatarObjectKey: objectKey, updatedAt: new Date() },
    })
  return { ok: true }
}

export async function getProfileSecurityImpl(): Promise<ProfileSecurityPage> {
  const { value } = await getSessionValue()

  // Better Auth returns null when the session cannot be resolved.
  const accounts = await callAuthApi<Array<{
    accountId: string
    providerId: string
    createdAt?: Date | null
  }> | null>('listUserAccounts')

  const sessions = await callAuthApi<Array<{
    token: string
    expiresAt: string | Date
    ipAddress?: string | null
    userAgent?: string | null
    createdAt?: string | Date
  }> | null>('listSessions')

  return {
    connectedAccounts: (accounts ?? []).map<ConnectedAccountItem>((account) => ({
      accountId: account.accountId,
      providerId: account.providerId,
      createdAt: account.createdAt ? new Date(account.createdAt).toISOString() : null,
    })),
    linkableProviders: authServerConfigSummary(),
    hasCredentialAccount: (accounts ?? []).some((account) => account.providerId === 'credential'),
    twoFactorEnabled: value.user.twoFactorEnabled === true,
    sessions: (sessions ?? []).map((session) => ({
      token: session.token,
      isCurrent: session.token === value.session.token,
      ipAddress: session.ipAddress ?? null,
      userAgent: session.userAgent ?? null,
      createdAt: session.createdAt
        ? new Date(session.createdAt).toISOString()
        : new Date().toISOString(),
      expiresAt: new Date(session.expiresAt).toISOString(),
    })),
    availability: 'ok',
  }
}

export async function changePasswordImpl(input: {
  currentPassword: string
  newPassword: string
}): Promise<{ ok: true }> {
  await getSessionValue()
  await callAuthApi('changePassword', {
    body: {
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
      revokeOtherSessions: false,
    },
  })
  return { ok: true }
}

export async function revokeSessionImpl(input: { token: string }): Promise<{ ok: true }> {
  await getSessionValue()
  await callAuthApi('revokeSession', { body: { token: input.token } })
  return { ok: true }
}

export async function revokeOtherSessionsImpl(): Promise<{ ok: true }> {
  await getSessionValue()
  await callAuthApi('revokeOtherSessions')
  return { ok: true }
}

export async function unlinkAccountImpl(input: UnlinkAccountInput): Promise<{ ok: true }> {
  await getSessionValue()

  // Last sign-in guard (spec): at least one method must remain.
  const accounts = await callAuthApi<Array<{ accountId: string; providerId: string }> | null>(
    'listUserAccounts',
  )
  if (accounts == null || accounts.length <= 1) {
    throw new Error('LAST_SIGN_IN: You need at least one sign-in method to access your account.')
  }

  await callAuthApi('unlinkAccount', {
    body: { providerId: input.providerId, accountId: input.accountId },
  })
  return { ok: true }
}

export async function getAccountLinkUrlImpl(
  provider: 'google' | 'telegram',
): Promise<{ url: string | null }> {
  await getSessionValue()
  const summary = authServerConfigSummary()
  const configured = summary.find((item) => item.provider === provider)?.configured
  if (!configured) return { url: null }

  const result = await callAuthApi<{ url?: string; redirect?: string } | null>(
    'linkSocialAccount',
    { body: { provider, callbackURL: '/settings/profile' } },
  )
  return { url: (result?.url ?? result?.redirect) || null }
}

export async function startMfaEnrollmentImpl(): Promise<MfaEnrollment> {
  await getSessionValue()
  const result = await callAuthApi<{
    totpURI?: string
    backupCodes?: Array<{ code: string }> | string[]
  } | null>('enableTwoFactor', { body: {} })

  const backupCodes = (result?.backupCodes ?? []).map((code) =>
    typeof code === 'string' ? code : code.code,
  )

  let totpUri = result?.totpURI ?? ''
  let secret = extractSecret(totpUri)

  if (!totpUri) {
    // Some flows require an explicit URI fetch after enabling.
    const uri = await callAuthApi<{ totpURI?: string } | null>('getTOTPURI', { body: {} })
    totpUri = uri?.totpURI ?? ''
    secret = extractSecret(totpUri)
  }

  return { totpUri, secret, backupCodes: backupCodes.filter(Boolean) }
}

function extractSecret(totpUri: string): string {
  const match = /[?&]secret=([^&]+)/.exec(totpUri)
  return match?.[1] ?? ''
}

export async function verifyMfaEnrollmentImpl(input: VerifyTotpInput): Promise<{ ok: true }> {
  await getSessionValue()
  await callAuthApi('verifyTOTP', { body: { code: input.code } })
  return { ok: true }
}

export async function disableMfaImpl(input: DisableTotpInput): Promise<{ ok: true }> {
  await getSessionValue()
  await callAuthApi('disableTwoFactor', { body: { password: input.password } })
  return { ok: true }
}
