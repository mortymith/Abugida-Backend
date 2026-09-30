import { createServerFn } from '@tanstack/react-start'

/**
 * Client-safe S-0.3 MFA challenge server functions. Impls are dynamically
 * imported so server-only code never enters the client bundle.
 */
export const getMfaChallengeStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const { getMfaChallengeStatusImpl } = await import('./auth.mfa.impl.server')
  return getMfaChallengeStatusImpl()
})

export const verifyMfaChallenge = createServerFn({ method: 'POST' })
  .validator((input: { code: string; mode: 'totp' | 'backup' }) => input)
  .handler(async ({ data }) => {
    const { verifyMfaChallengeImpl } = await import('./auth.mfa.impl.server')
    return verifyMfaChallengeImpl(data)
  })

/** "Request an admin reset" — only offered when a second verified Admin exists. */
export const requestAdminMfaReset = createServerFn({ method: 'POST' }).handler(async () => {
  const { requestAdminMfaResetImpl } = await import('./auth.mfa.impl.server')
  return requestAdminMfaResetImpl()
})

/** "Open a support request" — the only-Admin path. Never a dead end. */
export const requestSupportMfaRecovery = createServerFn({ method: 'POST' }).handler(async () => {
  const { requestSupportMfaRecoveryImpl } = await import('./auth.mfa.impl.server')
  return requestSupportMfaRecoveryImpl()
})
