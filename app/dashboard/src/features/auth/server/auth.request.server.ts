/**
 * Server-only request helpers shared by the auth feature's server functions.
 * Never import from client code.
 */
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/config/auth.server'

/**
 * The client address, taken from the first hop of `X-Forwarded-For` and falling
 * back to the platform header. Used for per-provider sign-in throttling and the
 * `login_events` audit trail.
 */
export function clientIp(): string | null {
  const request = getRequest()
  const forwarded = request.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first || request.headers.get('x-real-ip') || null
}

/** A short, user-quotable reference for error copy ("Reference: abc123"). */
export function requestId(): string {
  const request = getRequest()
  return (
    request.headers.get('x-request-id') ??
    crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
  )
}

/** Resolve the caller's user id, or `null` when unauthenticated. */
export async function currentUserId(): Promise<string | null> {
  const request = getRequest()
  const session = await auth.getSession(request.headers)
  return session.ok ? session.value.user.id : null
}

/** Resolve the caller's user id, throwing when unauthenticated. */
export async function requireUserId(): Promise<string> {
  const userId = await currentUserId()
  if (!userId) throw new Error('UNAUTHENTICATED')
  return userId
}

/** The caller's Better Auth session user, for `twoFactorEnabled` etc. */
export async function currentSessionUser(): Promise<{
  id: string
  twoFactorEnabled: boolean
} | null> {
  const request = getRequest()
  const session = await auth.getSession(request.headers)
  if (!session.ok) return null
  const user = session.value.user as typeof session.value.user & { twoFactorEnabled?: boolean }
  return { id: user.id, twoFactorEnabled: user.twoFactorEnabled === true }
}
