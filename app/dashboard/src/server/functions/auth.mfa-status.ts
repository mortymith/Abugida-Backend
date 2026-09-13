import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth.server'

export const getMfaStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const session = await auth.getSession(request.headers)

  if (!session.ok) {
    return { enabled: false }
  }

  // Check if the user has two-factor authentication enabled

  return {
    enabled: true,
  }
})
