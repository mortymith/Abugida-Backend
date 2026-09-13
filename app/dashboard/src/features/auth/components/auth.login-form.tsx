import { useState } from 'react'

import type { Provider } from '#/features/auth/hooks/auth.provider-memory'
import { authClient } from '#/lib/auth-client'
import { useLastProvider } from '#/features/auth/hooks/auth.provider-memory'
import { ProviderButton } from '#/features/auth/components/auth.provider-button'
import { RedirectingOverlay } from '#/features/auth/components/auth.redirecting-overlay'
import { ErrorMessage } from '#/components/common/error-message'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

interface LoginFormProps {
  redirectTo?: string
  /** Error code returned by the OAuth callback (e.g. after a cancelled or mismatched sign-in) */
  callbackError?: string
}

/** Maps OAuth callback error codes to user-facing messages (see spec S-0.1 states). */
const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  unknown_account:
    "This account isn't linked to any workspace. Ask your Admin to invite you, or create a workspace.",
  invite_email_mismatch:
    'You signed in with a different account than your invitation was sent to. Sign in with the matching Google or Telegram account.',
  identity_exists: 'This account already belongs to a workspace. Sign in instead.',
}

const FALLBACK_CALLBACK_ERROR = 'Sign-in failed. Please try again.'

function LoginForm({ redirectTo = '/dashboard', callbackError }: LoginFormProps) {
  const { lastProvider, setLastProvider } = useLastProvider()
  const [loading, setLoading] = useState<Provider | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleProviderSignIn = async (provider: Provider) => {
    setLoading(provider)
    setError(null)

    try {
      await authClient.signIn.social({
        provider,
        callbackURL: redirectTo,
      })
      setLastProvider(provider)
    } catch {
      setLoading(null)
      setError(
        provider === 'google'
          ? 'Google sign-in failed. Try again or use Telegram.'
          : 'Telegram sign-in failed. Try again or use Google.',
      )
    }
  }

  // The provider used last is offered first (see spec S-0.1 default state).
  const providers: Provider[] = lastProvider
    ? [lastProvider, lastProvider === 'google' ? 'telegram-oidc' : 'google']
    : ['google', 'telegram-oidc']

  const message =
    error ??
    (callbackError ? (CALLBACK_ERROR_MESSAGES[callbackError] ?? FALLBACK_CALLBACK_ERROR) : null)

  return (
    <>
      {loading && <RedirectingOverlay provider={loading} />}

      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-lg font-semibold">Sign in to your workspace</CardTitle>
          <CardDescription>Choose a provider to continue to Abugida Academy.</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {message && <ErrorMessage message={message} className="mb-1" />}

          {providers.map((provider) => (
            <ProviderButton
              key={provider}
              provider={provider}
              onClick={() => handleProviderSignIn(provider)}
              loading={loading === provider}
              disabled={loading !== null}
            />
          ))}
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-xs text-muted-foreground">
            Providers are managed in your workspace settings.
          </p>
        </CardFooter>
      </Card>
    </>
  )
}

export { LoginForm }
