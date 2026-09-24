import { useState } from 'react'

import type { Provider } from '#/features/auth/hooks/auth.provider-memory'
import { authClient } from '#/lib/auth-client'
import { useLastProvider } from '#/features/auth/hooks/auth.provider-memory'
import { ProviderButton } from '#/features/auth/components/auth.provider-button'
import { RedirectingOverlay } from '#/features/auth/components/auth.redirecting-overlay'
import { ErrorMessage } from '#/components/common/error-message'

interface SignupStep1Props {
  availableProviders: Provider[]
}

function SignupStep1({ availableProviders }: SignupStep1Props) {
  const { lastProvider, setLastProvider } = useLastProvider()
  const [loading, setLoading] = useState<Provider | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleProviderSignIn = async (provider: Provider) => {
    setLoading(provider)
    setError(null)

    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: '/signup',
      })

      if (result.error) {
        throw new Error(result.error.message ?? 'Sign-in failed')
      }

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

  const providers: Provider[] =
    lastProvider && availableProviders.includes(lastProvider)
      ? [lastProvider, ...availableProviders.filter((provider) => provider !== lastProvider)]
      : availableProviders

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
