import { describe, expect, it } from 'bun:test'
import {
  serverAccessToken,
  serverRefreshedSession,
  serverSession,
  serverSignOut,
} from '../src/core/handlers'
import type { AuthInstance } from '../src/core/auth'
import type { ResolvedSession } from '../src/core/session'
import type { AuthResult } from '../src/core/types'

function session(overrides: Partial<ResolvedSession> = {}): ResolvedSession {
  return {
    session: {
      id: 'session-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
      activeOrganizationId: null,
    },
    user: {
      id: 'user-1',
      email: 'user-1@abugida.app',
      name: 'User One',
      emailVerified: true,
      image: null,
    },
    ...overrides,
  }
}

function ok<T>(value: T): AuthResult<T> {
  return { ok: true, value }
}

/** Only the members the handlers touch. */
function fakeAuth(overrides: Partial<AuthInstance> = {}): AuthInstance {
  return {
    getSession: () => Promise.resolve(ok(session())),
    refreshSession: () => Promise.resolve(ok(session())),
    signOut: () => Promise.resolve(ok(true as const)),
    getAccessToken: () => Promise.resolve(ok({ accessToken: 'token-1' })),
    ...overrides,
  } as unknown as AuthInstance
}

const headers = new Headers({ cookie: 'session=abc' })

describe('server-function handlers', () => {
  it('unwraps a session result', async () => {
    expect((await serverSession(fakeAuth(), headers))?.user.id).toBe('user-1')
  })

  it('returns null instead of an error result for a signed-out caller', async () => {
    const auth = fakeAuth({
      getSession: () =>
        Promise.resolve({ ok: false, error: { kind: 'unauthorized', message: 'x' } }),
    })
    expect(await serverSession(auth, headers)).toBeNull()
  })

  it('delegates the refresh path so a stale cookie cache can be bypassed', async () => {
    let called = 0
    const auth = fakeAuth({
      refreshSession: () => {
        called += 1
        return Promise.resolve(ok(session()))
      },
    })

    await serverRefreshedSession(auth, headers)
    expect(called).toBe(1)
  })

  it('reports sign-out success even when no session was present', async () => {
    const auth = fakeAuth({
      signOut: () => Promise.resolve({ ok: false, error: { kind: 'unknown', message: 'x' } }),
    })
    // Sign-out is idempotent from the caller's point of view: the session is
    // gone either way, and the caller must not be left with a 500.
    expect(await serverSignOut(auth, headers)).toEqual({ success: true })
  })

  it('returns the access token for the calling user only', async () => {
    const requested: Array<{ userId: string; providerId: string }> = []
    const auth = fakeAuth({
      getAccessToken: ({ userId, providerId }: { userId: string; providerId: string }) => {
        requested.push({ userId, providerId })
        return Promise.resolve(ok({ accessToken: 'token-1' }))
      },
    })

    expect(await serverAccessToken(auth, headers, 'google')).toBe('token-1')
    expect(requested).toEqual([{ userId: 'user-1', providerId: 'google' }])
  })

  it('returns null when the caller has no session', async () => {
    const auth = fakeAuth({
      getSession: () =>
        Promise.resolve({ ok: false, error: { kind: 'unauthorized', message: 'x' } }),
    })
    expect(await serverAccessToken(auth, headers, 'google')).toBeNull()
  })

  it('returns null when no usable token exists', async () => {
    const auth = fakeAuth({
      getAccessToken: () =>
        Promise.resolve({ ok: false, error: { kind: 'provider_error', message: 'x' } }),
    })
    expect(await serverAccessToken(auth, headers, 'google')).toBeNull()
  })
})
