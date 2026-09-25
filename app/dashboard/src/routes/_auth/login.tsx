import { useEffect } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'

import { useSession } from '#/features/auth/hooks/auth.session'
import { LoginForm } from '#/features/auth/components/auth.login-form'

type LoginSearch = {
  error?: string
  redirectTo?: string
}

function isSafeRedirectPath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
}

export const Route = createFileRoute('/_auth/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    error: typeof search.error === 'string' ? search.error : undefined,
    redirectTo:
      typeof search.redirectTo === 'string' && isSafeRedirectPath(search.redirectTo)
        ? search.redirectTo
        : undefined,
  }),
  component: LoginPage,
})

function LoginPage() {
  const { error, redirectTo } = Route.useSearch()
  const { data: session } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    if (session) {
      void navigate({ to: redirectTo ?? '/dashboard', replace: true })
    }
  }, [navigate, redirectTo, session])

  return (
    <div className="flex flex-col gap-6">
      <LoginForm redirectTo={redirectTo ?? '/dashboard'} callbackError={error} />

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
