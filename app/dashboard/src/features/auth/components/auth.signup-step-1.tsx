import { useState } from 'react'

import type { Provider } from '#/features/auth/hooks/auth.provider-memory'
import { authClient } from '#/lib/auth-client'
import { useLastProvider } from '#/features/auth/hooks/auth.provider-memory'
import { ProviderButton } from '#/features/auth/components/auth.provider-button'
import { RedirectingOverlay } from '#/features/auth/components/auth.redirecting-overlay'
import { ErrorMessage } from '#/components/common/error-message'

interface SignupStep1Props {
  onComplete: () => void
}

function SignupStep1({ onComplete }: SignupStep1Props) {
  const { lastProvider, setLastProvider } = useLastProvider()
  const [loading, setLoading] = useState<Provider | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleProviderSignIn = async (provider: Provider) => {
    setLoading(provider)
    setError(null)

    try {
      await authClient.signIn.social({
        provider,
        callbackURL: '/signup',
      })
      setLastProvider(provider)
      onComplete()
    } catch {
      setLoading(null)
      setError(
        provider === 'google'
          ? 'Google sign-in failed. Try again or use Telegram.'
          : 'Telegram sign-in failed. Try again or use Google.',
      )
    }
  }

  const providers: Provider[] = lastProvider
    ? [lastProvider, lastProvider === 'google' ? 'telegram-oidc' : 'google']
    : ['google', 'telegram-oidc']

  return (
    <>
      {loading && <RedirectingOverlay provider={loading} />}

      <div className="flex flex-col gap-3">
        {error && <ErrorMessage message={error} className="mb-1" />}

        {providers.map((provider) => (
          <ProviderButton
            key={provider}
            provider={provider}
            onClick={() => handleProviderSignIn(provider)}
            loading={loading === provider}
            disabled={loading !== null}
          />
        ))}

        <p className="mt-1 text-center text-xs text-muted-foreground">
          Your admin profile is created from your verified provider identity — no password is ever
          set.
        </p>
      </div>
    </>
  )
}

export { SignupStep1 }
