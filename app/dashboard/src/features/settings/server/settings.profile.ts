import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { MfaEnrollment, ProfileSecurityPage, ProfileSummary } from '../settings.types'
import {
  avatarUploadSchema,
  changePasswordSchema,
  disableTotpSchema,
  revokeSessionSchema,
  unlinkAccountSchema,
  updateProfileSchema,
  verifyTotpSchema,
} from '../schemas/settings.schema'

const objectKeySchema = z.string().trim().min(1).max(500)
const providerSchema = z.enum(['google', 'telegram'])

/**
 * Client-safe S-6.5 My Profile & Account server functions. Sensitive
 * operations (password, MFA, sessions, connected accounts) all run through
 * the existing Better Auth server instance — never manual credential or
 * session manipulation. Impls are dynamically imported.
 */

export const getProfile = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ProfileSummary> => {
    const { getProfileImpl } = await import('./settings.profile.impl.server')
    return getProfileImpl()
  },
)

export const updateProfile = createServerFn({ method: 'POST' })
  .validator((input: unknown) => updateProfileSchema.parse(input))
  .handler(async ({ data }) => {
    const { updateProfileImpl } = await import('./settings.profile.impl.server')
    return updateProfileImpl(data)
  })

export const getAvatarUploadUrl = createServerFn({ method: 'POST' })
  .validator((input: unknown) => avatarUploadSchema.parse(input))
  .handler(
    async ({ data }): Promise<{ objectKey: string; uploadUrl: string; expiresIn: number }> => {
      const { getAvatarUploadUrlImpl } = await import('./settings.profile.impl.server')
      return getAvatarUploadUrlImpl(data)
    },
  )

export const markAvatarUploaded = createServerFn({ method: 'POST' })
  .validator((input: unknown) => objectKeySchema.parse(input))
  .handler(async ({ data }) => {
    const { markAvatarUploadedImpl } = await import('./settings.profile.impl.server')
    return markAvatarUploadedImpl(data)
  })

export const getProfileSecurity = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ProfileSecurityPage> => {
    const { getProfileSecurityImpl } = await import('./settings.profile.impl.server')
    return getProfileSecurityImpl()
  },
)

export const changePassword = createServerFn({ method: 'POST' })
  .validator((input: unknown) => changePasswordSchema.parse(input))
  .handler(async ({ data }) => {
    const { changePasswordImpl } = await import('./settings.profile.impl.server')
    return changePasswordImpl(data)
  })

export const revokeSession = createServerFn({ method: 'POST' })
  .validator((input: unknown) => revokeSessionSchema.parse(input))
  .handler(async ({ data }) => {
    const { revokeSessionImpl } = await import('./settings.profile.impl.server')
    return revokeSessionImpl(data)
  })

export const revokeOtherSessions = createServerFn({ method: 'POST' }).handler(async () => {
  const { revokeOtherSessionsImpl } = await import('./settings.profile.impl.server')
  return revokeOtherSessionsImpl()
})

export const unlinkConnectedAccount = createServerFn({ method: 'POST' })
  .validator((input: unknown) => unlinkAccountSchema.parse(input))
  .handler(async ({ data }) => {
    const { unlinkAccountImpl } = await import('./settings.profile.impl.server')
    return unlinkAccountImpl(data)
  })

export const getAccountLinkUrl = createServerFn({ method: 'POST' })
  .validator((input: unknown) => providerSchema.parse(input))
  .handler(async ({ data }): Promise<{ url: string | null }> => {
    const { getAccountLinkUrlImpl } = await import('./settings.profile.impl.server')
    return getAccountLinkUrlImpl(data)
  })

export const startMfaEnrollment = createServerFn({ method: 'POST' }).handler(
  async (): Promise<MfaEnrollment> => {
    const { startMfaEnrollmentImpl } = await import('./settings.profile.impl.server')
    return startMfaEnrollmentImpl()
  },
)

export const verifyMfaEnrollment = createServerFn({ method: 'POST' })
  .validator((input: unknown) => verifyTotpSchema.parse(input))
  .handler(async ({ data }) => {
    const { verifyMfaEnrollmentImpl } = await import('./settings.profile.impl.server')
    return verifyMfaEnrollmentImpl(data)
  })

export const disableMfa = createServerFn({ method: 'POST' })
  .validator((input: unknown) => disableTotpSchema.parse(input))
  .handler(async ({ data }) => {
    const { disableMfaImpl } = await import('./settings.profile.impl.server')
    return disableMfaImpl(data)
  })
