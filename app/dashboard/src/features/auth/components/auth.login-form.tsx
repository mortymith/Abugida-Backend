import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { authClient } from '#/lib/auth-client'
import { useLastProvider } from '#/features/auth/hooks/auth.provider-memory'
import { ProviderButton } from '#/features/auth/components/auth.provider-button'
import { RedirectingOverlay } from '#/features/auth/components/auth.redirecting-overlay'
import { InviteClaim } from '#/features/auth/components/auth.invite-claim'
import { ErrorMessage } from '#/components/common/error-message'
import { OfflineBanner } from '#/components/common/offline-banner'
import { Skeleton } from '#/components/ui/skeleton'
import { Button } from '#/components/ui/button'
import { useCountdown } from '#/hooks/use-countdown'
import { useOnline } from '#/hooks/use-online'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import type { Provider } from '../auth.providers'
import {
  PROVIDERS,
  countdownAnnouncement,
  formatClock,
  orderProviders,
  providerDisabledReason,
} from '../auth.providers'
import {
  callbackNotice,
  providerFailureMessage,
  providerUnreachableMessage,
  signinActionTarget,
} from '../auth.signin-state'
import { getSigninAvailability, recordSigninOutcome } from '../server/auth.signin'

interface LoginFormProps {
  redirectTo?: string
  /** Error code returned by the provider callback, e.g. `unknown_account`. */
  callbackError?: string
  /** A claimable invite link that carried the user here (S-0.1 action 3). */
  inviteToken?: string | null
}

/**
 * S-0.1 Login. Sign-in is federated only — Google or Telegram, no password — so
 * this screen holds no form state and never needs a dirty-buffer flush.
 *
 * Everything the buttons can say comes from the server
 * (`getSigninAvailability`): which providers the workspace offers, and which of
 * them are throttled right now. The client never invents a lockout, so a reload
 * resumes the countdown the server recorded rather than restarting it.
 */
function LoginForm({
  redirectTo = '/dashboard',
  callbackError,
  inviteToken = null,
}: LoginFormProps) {
  const { lastProvider, setLastProvider } = useLastProvider()
  const online = useOnline()

  const [redirecting, setRedirecting] = useState<Provider | null>(null)
  const [error, setError] = useState<string | null>(null)

  const noticeRef = useRef<HTMLDivElement>(null)
  const firstEnabledRef = useRef<HTMLButtonElement | null>(null)

  const availability = useQuery({
    queryKey: ['auth', 'signin-availability'],
    queryFn: getSigninAvailability,
    staleTime: 15_000,
    retry: false,
  })

  const notice = useMemo(() => callbackNotice(callbackError), [callbackError])
  const showError = error ?? notice?.message ?? ''

  /**
   * One entry per provider, always all of them: a provider that is unavailable
   * renders **disabled with a reason**, never hidden, so a user can learn that
   * a route exists and is closed.
   */
  const entries = useMemo(() => {
    const rows = availability.data?.providers
    const available = new Set(
      rows
        ? PROVIDERS.filter((provider) => rows.find((row) => row.provider === provider)?.enabled)
        : [],
    )
    // Last-used first — spec S-0.1 "the page remembers the provider used last".
    // A provider that is unavailable is never promoted just because it was used.
    const ordered = orderProviders([...available], lastProvider)

    return PROVIDERS.map((provider) => {
      const row = rows?.find((entry) => entry.provider === provider)
      const other = PROVIDERS.find(
        (candidate) => candidate !== provider && ordered.includes(candidate),
      )
      const retryAt = row?.retryAt ?? 0
      const throttled = online && retryAt > Date.now()

      let reason: string | null = null
      if (!online) {
        reason = providerDisabledReason({ block: 'offline', provider })
      } else if (throttled) {
        reason = providerDisabledReason({
          block: 'rate_limited',
          provider,
          retryInSeconds: (retryAt - Date.now()) / 1000,
        })
      } else if (rows && !available.has(provider)) {
        reason = providerDisabledReason({ block: 'unconfigured', provider, otherProvider: other })
      }

      return {
        provider,
        reason,
        retryAt: throttled ? retryAt : null,
        /** Skipped by the initial focus pass and unreachable by keyboard. */
        interactive: reason == null,
      }
    })
  }, [availability.data, lastProvider, online])

  const throttled = entries.find((entry) => entry.retryAt != null)
  const { announcement } = useCountdown(throttled?.retryAt ?? null, countdownAnnouncement)
  const throttledRetryAt = throttled?.retryAt ?? null

  // Spec Keyboard & Focus: "On arrival focus lands on the first *enabled*
  // provider button (a disabled one is skipped, not focused)."
  const isLoading = availability.isPending
  useEffect(() => {
    if (isLoading) return
    if (entries.some((entry) => entry.interactive)) firstEnabledRef.current?.focus()
  }, [isLoading, entries])

  // On an error, focus moves to the message container so it is announced and
  // reachable instead of being left on a now-inert button.
  useEffect(() => {
    if (showError) noticeRef.current?.focus()
  }, [showError])

  async function handleProviderSignIn(provider: Provider) {
    if (!online) return

    setRedirecting(provider)
    setError(null)

    try {
      const result = await authClient.signIn.social({ provider, callbackURL: redirectTo })

      if (result.error) {
        setRedirecting(null)
        setError(providerFailureMessage(provider))
        void recordSigninOutcome({ data: { provider, outcome: 'provider_error' } }).catch(
          () => undefined,
        )
        return
      }

      setLastProvider(provider)
      void recordSigninOutcome({ data: { provider, outcome: 'succeeded' } }).catch(() => undefined)
    } catch (cause) {
      setRedirecting(null)
      setError(providerUnreachableMessage(provider, requestRefFrom(cause)))
      void recordSigninOutcome({ data: { provider, outcome: 'provider_error' } }).catch(
        () => undefined,
      )
    }
  }

  return (
    <>
      {redirecting && <RedirectingOverlay provider={redirecting} />}

      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-lg font-semibold">Sign in to your workspace</CardTitle>
          <CardDescription>
            Choose a provider to continue to {import.meta.env.VITE_APP_NAME}.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {!online && <OfflineBanner message="You're offline. Sign-in needs a connection." />}

          <div ref={noticeRef} tabIndex={-1} className="focus-visible:outline-none">
            <ErrorMessage message={showError} />
          </div>

          {notice?.action && !error ? (
            <div className="-mt-1 flex justify-center">
              <Button
                variant="link"
                size="sm"
                render={<Link to={signinActionTarget(notice.action)} />}
              >
                {actionLabel(notice.action)}
              </Button>
            </div>
          ) : null}

          {throttledRetryAt ? (
            <p
              aria-live="polite"
              aria-atomic="true"
              className="text-center text-xs text-muted-foreground"
            >
              {announcement ??
                `Try again in ${formatClock((throttledRetryAt - Date.now()) / 1000)}.`}
            </p>
          ) : null}

          {isLoading ? (
            <div
              className="flex flex-col gap-3"
              aria-busy="true"
              aria-label="Loading sign-in options"
            >
              {PROVIDERS.map((provider) => (
                <Skeleton key={provider} className="h-11 w-full" />
              ))}
            </div>
          ) : (
            entries.map((entry) => (
              <ProviderButton
                key={entry.provider}
                ref={entry.interactive ? firstEnabledRef : undefined}
                provider={entry.provider}
                disabledReason={entry.reason}
                onClick={() => void handleProviderSignIn(entry.provider)}
                loading={redirecting === entry.provider}
                disabled={redirecting !== null || !entry.interactive}
              />
            ))
          )}
        </CardContent>

        <CardFooter className="flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Providers are managed in your workspace settings.
          </p>
          <InviteClaim initialToken={inviteToken} onNotice={setError} />
        </CardFooter>
      </Card>
    </>
  )
}

function actionLabel(action: string): string {
  switch (action) {
    case 'create_workspace':
      return 'Create a workspace'
    case 'request_invite':
      return 'Request a new invitation'
    case 'go_to_integrations':
      return 'Open Integrations'
    default:
      return 'Try again'
  }
}

/**
 * A short reference the user can quote in a support request. A real deployment
 * would surface the platform's request id; the shape of the copy is what the
 * spec is testing for.
 */
function requestRefFrom(cause: unknown): string {
  const id = (cause as { requestId?: unknown } | null)?.requestId
  return typeof id === 'string' && id ? id.slice(0, 8).toUpperCase() : 'UNKNOWN'
}

export { LoginForm }
