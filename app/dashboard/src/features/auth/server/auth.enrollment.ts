import { createServerFn } from '@tanstack/react-start'

/**
 * Client-safe S-0.4 MFA enrollment server functions. Impls are dynamically
 * imported so server-only code never enters the client bundle.
 */
export const getEnrollmentStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const { getEnrollmentStatusImpl } = await import('./auth.enrollment.impl.server')
  return getEnrollmentStatusImpl()
})

export const startEnrollment = createServerFn({ method: 'POST' })
  .validator(
    (input?: { entryPoint?: 'settings' | 'policy_prompt' | 'support_recovery' }) => input ?? {},
  )
  .handler(async ({ data }) => {
    const { startEnrollmentImpl } = await import('./auth.enrollment.impl.server')
    return startEnrollmentImpl(data.entryPoint ?? 'settings')
  })

export const confirmEnrollment = createServerFn({ method: 'POST' })
  .validator(
    (input: { code: string; clientTimestampMs?: number | null; attempts?: number | null }) => input,
  )
  .handler(async ({ data }) => {
    const { confirmEnrollmentImpl } = await import('./auth.enrollment.impl.server')
    return confirmEnrollmentImpl(data)
  })

export const regenerateBackupCodes = createServerFn({ method: 'POST' })
  .validator((input?: { reason?: 'initial' | 'regenerate' }) => input ?? {})
  .handler(async ({ data }) => {
    const { regenerateBackupCodesImpl } = await import('./auth.enrollment.impl.server')
    return regenerateBackupCodesImpl(data.reason ?? 'initial')
  })

export const replaceAuthenticator = createServerFn({ method: 'POST' }).handler(async () => {
  const { replaceAuthenticatorImpl } = await import('./auth.enrollment.impl.server')
  return replaceAuthenticatorImpl()
})

export const disableEnrollment = createServerFn({ method: 'POST' }).handler(async () => {
  const { disableEnrollmentImpl } = await import('./auth.enrollment.impl.server')
  return disableEnrollmentImpl()
})
