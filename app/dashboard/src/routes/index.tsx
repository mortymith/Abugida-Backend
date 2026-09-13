import { createFileRoute, redirect } from '@tanstack/react-router'
import { authServerFns } from '#/lib/auth.config'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await authServerFns.getServerSession()
    if (session) {
      throw redirect({ to: '/dashboard' })
    }
    throw redirect({ to: '/login' })
  },
})
