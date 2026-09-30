import { useEffect } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'

import { useSession } from '#/features/auth/hooks/auth.session'
import { LoginForm } from '#/features/auth/components/auth.login-form'

type LoginSearch = {
  error?: string
  redirectTo?: string
  invite?: string
}

/**
 * Reject anything that is not a same-origin absolute path. Without this a
 * `?redirectTo=https://evil.example` would turn the login screen into an open
 * redirect after a successful sign-in.
 */
function isSafeRedirectPath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
}

/** S-0.1 Login. All the screen's state lives in the form component. */
export const Route = createFileRoute('/_auth/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    error: typeof search.error === 'string' ? search.error : undefined,
    redirectTo:
      typeof search.redirectTo === 'string' && isSafeRedirectPath(search.redirectTo)
        ? search.redirectTo
        : undefined,
    invite: typeof search.invite === 'string' ? search.invite : undefined,
  }),
  component: LoginPage,
})

function LoginPage() {
  const { error, redirectTo, invite } = Route.useSearch()
  const { data: session } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    if (session) {
      void navigate({ to: redirectTo ?? '/dashboard', replace: true })
    }
  }, [navigate, redirectTo, session])

  return (
    <div className="flex flex-col gap-6">
      <LoginForm
        redirectTo={redirectTo ?? import.meta.env.VITE_DEFAULT_LOGIN_REDIRECT ?? '/dashboard'}
        callbackError={error}
        inviteToken={invite}
      />

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
