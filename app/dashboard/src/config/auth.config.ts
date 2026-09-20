import { createServerFn } from '@tanstack/react-start'
import type { AuthServerFunctions } from '@abugida/auth/tanstack/server'

export const getServerSession = createServerFn({ method: 'GET' }).handler(async () => {
  const { getRequest } = await import('@tanstack/react-start/server')
  const { auth } = await import('./auth.server')
  const request = getRequest()
  const result = await auth.getSession(request.headers)
  return result.ok ? result.value : null
})

export const refreshServerSession = createServerFn({ method: 'GET' }).handler(async () => {
  const { getRequest } = await import('@tanstack/react-start/server')
  const { auth } = await import('./auth.server')
  const request = getRequest()
  const result = await auth.refreshSession(request.headers)
  return result.ok ? result.value : null
})

export const signOutServer = createServerFn({ method: 'POST' }).handler(async () => {
  const { getRequest } = await import('@tanstack/react-start/server')
  const { auth } = await import('./auth.server')
  const request = getRequest()
  await auth.signOut(request.headers)
  return { success: true as const }
})

export const getServerAccessToken = createServerFn({ method: 'GET' })
  .validator((input: { providerId: string }) => input)
  .handler(async ({ data }) => {
    const { getRequest } = await import('@tanstack/react-start/server')
    const { auth } = await import('./auth.server')
    const request = getRequest()
    const session = await auth.getSession(request.headers)
    if (!session.ok) return null

    const token = await auth.getAccessToken({
      userId: session.value.user.id,
      providerId: data.providerId,
    })
    return token.ok ? token.value.accessToken : null
  })

export const authServerFns: AuthServerFunctions = {
  getServerSession,
  refreshServerSession,
  signOutServer,
  getServerAccessToken,
}
