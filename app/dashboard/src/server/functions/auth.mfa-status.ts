import { createServerFn } from '@tanstack/react-start'

export const getMfaStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const { getRequest } = await import('@tanstack/react-start/server')
  const { auth } = await import('#/config/auth.server')
  const request = getRequest()

  const session = await auth.raw.api.getSession({
    headers: request.headers,
  })

  if (!session?.user) {
    return { enabled: false }
  }

  const user = session.user as typeof session.user & { twoFactorEnabled?: boolean }

  return {
    enabled: user.twoFactorEnabled === true,
  }
})
