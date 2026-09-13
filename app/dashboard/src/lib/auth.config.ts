import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import type { AuthServerFunctions } from '@abugida/auth/tanstack'
import { auth } from './auth.server'

export const getServerSession = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const result = await auth.getSession(request.headers)
  return result.ok ? result.value : null
})

export const refreshServerSession = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const result = await auth.refreshSession(request.headers)
  return result.ok ? result.value : null
})

export const signOutServer = createServerFn({ method: 'POST' }).handler(async () => {
  const request = getRequest()
  await auth.signOut(request.headers)
  return { success: true as const }
})

export const getServerAccessToken = createServerFn({ method: 'GET' })
  .validator((input: { providerId: string }) => input)
  .handler(async ({ data }) => {
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
