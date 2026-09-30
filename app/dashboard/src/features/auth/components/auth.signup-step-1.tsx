import { useEffect, useMemo, useState } from 'react'

import { authClient } from '#/lib/auth-client'
import { useLastProvider } from '#/features/auth/hooks/auth.provider-memory'
import { ProviderButton } from '#/features/auth/components/auth.provider-button'
import { RedirectingOverlay } from '#/features/auth/components/auth.redirecting-overlay'
import { ErrorMessage } from '#/components/common/error-message'
import { OfflineBanner } from '#/components/common/offline-banner'
import { Skeleton } from '#/components/ui/skeleton'
import {
  providerFailureMessage,
  providerUnreachableMessage,
} from '#/features/auth/auth.signin-state'
import { recordSigninOutcome } from '#/features/auth/server/auth.signin'
import type { Provider } from '#/features/auth/auth.providers'
import { orderProviders } from '#/features/auth/auth.providers'

interface SignupStep1Props {
  availableProviders: Provider[] | null
  online: boolean
  onSignedIn?: () => void
}

/**
 * S-0.2 step 1 (Account). The Admin profile is created from the verified
 * provider identity — no password is ever set, and an email address is never
 * required, because a Telegram user may not have one.
 */
function SignupStep1({ availableProviders, online, onSignedIn }: SignupStep1Props) {
  const { lastProvider, setLastProvider } = useLastProvider()
  const [loading, setLoading] = useState<Provider | null>(null)
  const [error, setError] = useState<string | null>(null)

  const providers = useMemo(
    () => orderProviders(availableProviders ?? [], lastProvider),
    [availableProviders, lastProvider],
  )

  // Once the provider round-trip completes, the session exists; the wizard
  // advances on its own rather than making the user click through.
  useEffect(() => {
    onSignedIn?.()
  }, [onSignedIn])

  async function handleProviderSignIn(provider: Provider) {
    if (!online) return

    setLoading(provider)
    setError(null)

    try {
      const result = await authClient.signIn.social({ provider, callbackURL: '/signup' })

      if (result.error) {
        setLoading(null)
        setError(providerFailureMessage(provider))
        void recordSigninOutcome({ data: { provider, outcome: 'provider_error' } }).catch(
          () => undefined,
        )
        return
      }

      setLastProvider(provider)
      void recordSigninOutcome({ data: { provider, outcome: 'succeeded' } }).catch(() => undefined)
    } catch (cause) {
      setLoading(null)
      const ref = (cause as { requestId?: string } | null)?.requestId
      setError(
        providerUnreachableMessage(provider, ref ? ref.slice(0, 8).toUpperCase() : 'UNKNOWN'),
      )
      void recordSigninOutcome({ data: { provider, outcome: 'provider_error' } }).catch(
        () => undefined,
      )
    }
  }

  if (!availableProviders) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading sign-in options">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    )
  }

  return (
    <>
      {loading && <RedirectingOverlay provider={loading} />}

      <div className="flex flex-col gap-3">
        {!online && <OfflineBanner message="You're offline. Sign-in needs a connection." />}

        <ErrorMessage message={error ?? ''} />

        {providers.length === 0 ? (
          <ErrorMessage message="No sign-in provider is configured for this workspace. Ask an administrator to enable one." />
        ) : (
          providers.map((provider) => (
            <ProviderButton
              key={provider}
              provider={provider}
              onClick={() => void handleProviderSignIn(provider)}
              loading={loading === provider}
              disabled={loading !== null || !online}
            />
          ))
        )}

        <p className="mt-1 text-center text-xs leading-relaxed text-muted-foreground">
          Your admin profile is created from your verified provider identity — no password is ever
          set.
        </p>
      </div>
    </>
  )
}

export { SignupStep1 }
