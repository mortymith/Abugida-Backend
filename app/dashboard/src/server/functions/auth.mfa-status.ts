import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/config/auth.config'

export const getMfaStatus = createServerFn({ method: 'GET' }).handler(async () => {
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
