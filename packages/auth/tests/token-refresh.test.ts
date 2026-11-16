import { describe, it, expect } from 'bun:test'
import { getValidAccessToken } from '../src/core/token-refresh'
import type { Auth } from 'better-auth'

function fakeAuth(
  getAccessTokenImpl: () => unknown,
  accounts: Array<{ id: string; providerId: string }> = [
    { id: 'acc_google', providerId: 'google' },
    { id: 'acc_telegram', providerId: 'telegram-oidc' },
  ],
): Auth {
  return {
    $context: Promise.resolve({
      internalAdapter: { findAccounts: async () => accounts },
    }),
    api: { getAccessToken: getAccessTokenImpl },
  } as unknown as Auth
}

describe('getValidAccessToken', () => {
  it('resolves the linked account id before calling better-auth', async () => {
    let receivedBody: unknown
    const auth = fakeAuth((body: unknown) => {
      receivedBody = body
      return { accessToken: 'at_123' }
    })
    const result = await getValidAccessToken(auth, { userId: 'u1', providerId: 'google' })
    expect(result.ok).toBe(true)
    expect(receivedBody).toEqual({ body: { accountId: 'acc_google', userId: 'u1' } })
  })

  it('returns a provider_error when the user has no account for the provider', async () => {
    const auth = fakeAuth(
      () => ({ accessToken: 'at_123' }),
      [{ id: 'acc_google', providerId: 'google' }],
    )
    const result = await getValidAccessToken(auth, { userId: 'u1', providerId: 'telegram-oidc' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('provider_error')
      expect((result.error as { providerId: string }).providerId).toBe('telegram-oidc')
    }
  })

  it('returns a provider_error when no linked account/token exists', async () => {
    const auth = fakeAuth(() => ({ accessToken: null }))
    const result = await getValidAccessToken(auth, { userId: 'u1', providerId: 'google' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('provider_error')
      expect((result.error as { providerId: string }).providerId).toBe('google')
    }
  })

  it('returns the access token and expiry on success', async () => {
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString()
    const auth = fakeAuth(() => ({ accessToken: 'at_123', accessTokenExpiresAt: expiresAt }))
    const result = await getValidAccessToken(auth, { userId: 'u1', providerId: 'google' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.accessToken).toBe('at_123')
      expect(result.value.expiresAt?.toISOString()).toBe(expiresAt)
    }
  })

  it('handles a missing expiry gracefully', async () => {
    const auth = fakeAuth(() => ({ accessToken: 'at_123' }))
    const result = await getValidAccessToken(auth, { userId: 'u1', providerId: 'telegram-oidc' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.expiresAt).toBeUndefined()
  })

  it('returns a provider_error when the underlying call throws (e.g. refresh_token revoked)', async () => {
    const auth = fakeAuth(() => {
      throw new Error('invalid_grant')
    })
    const result = await getValidAccessToken(auth, { userId: 'u1', providerId: 'google' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('provider_error')
  })

  it('never includes the raw token value in the error path', async () => {
    const auth = fakeAuth(() => {
      throw new Error('token leaked-value-should-not-appear')
    })
    const result = await getValidAccessToken(auth, { userId: 'u1', providerId: 'google' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).not.toContain('leaked-value-should-not-appear')
    }
  })
})
