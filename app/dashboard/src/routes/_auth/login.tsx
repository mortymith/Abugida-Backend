import { useEffect } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'

import { useSession } from '#/features/auth/hooks/auth.session'
import { LoginForm } from '#/features/auth/components/auth.login-form'

type LoginSearch = { error?: string }

export const Route = createFileRoute('/_auth/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: LoginPage,
})

function LoginPage() {
  const { error } = Route.useSearch()
  const { data: session } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    if (session) {
      navigate({ to: '/dashboard' })
    }
  }, [session, navigate])

  return (
    <div className="flex flex-col gap-6">
      <LoginForm redirectTo="/dashboard" callbackError={error} />

      <p className="anim-up d2 text-center text-sm text-muted-foreground">
        New here?{' '}
        <Link
          to="/signup"
          className="font-semibold text-foreground underline-offset-4 transition-colors hover:underline"
        >
          Create a workspace
        </Link>
      </p>
    </div>
  )
}
