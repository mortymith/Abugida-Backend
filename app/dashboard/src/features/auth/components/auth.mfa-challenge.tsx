import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { LifebuoyIcon, LockKeyholeIcon, UserSearch01Icon } from '@hugeicons/core-free-icons'

import { MfaInput } from '#/features/auth/components/auth.mfa-input'
import { ErrorMessage } from '#/components/common/error-message'
import { OfflineBanner } from '#/components/common/offline-banner'
import { useCountdown } from '#/hooks/use-countdown'
import { useOnline } from '#/hooks/use-online'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Field, FieldLabel } from '#/components/ui/field'
import { Skeleton } from '#/components/ui/skeleton'
import { Spinner } from '#/components/ui/spinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import {
  getMfaChallengeStatus,
  requestAdminMfaReset,
  requestSupportMfaRecovery,
  verifyMfaChallenge,
} from '#/features/auth/server/auth.mfa'
import {
  challengeNotice,
  formatClockTime,
  isLocked,
  lockLiftsAt,
  onlyAdminRecoveryMessage,
} from '../auth.mfa-lockout'
import { formatClock } from '../auth.providers'
import type { MfaChallengeStatus } from '../auth.mfa-lockout'
import type { MfaVerifyResult } from '#/features/auth/server/auth.mfa.impl.server'

/**
 * S-0.3 Multi-Factor Authentication Challenge.
 *
 * Two things this screen is careful about, both of which the previous version got
 * wrong:
 *
 *  - **The lock is the server's.** Attempts, the lock deadline and the recovery
 *    path all come from `getMfaChallengeStatus`, so a reload cannot be used to
 *    walk around the 5-attempt budget.
 *  - **There is no dead end.** The old copy told a locked-out user to "contact
 *    your workspace Admin" — including the user who *is* the only Admin. The
 *    screen now offers exactly one of two real recoveries: request an admin
 *    reset when a second verified Admin is reachable, or a support request that
 *    opens a 24-hour window when they are not.
 */
export function MfaChallenge() {
  const navigate = useNavigate()
  const online = useOnline()

  const [mode, setMode] = useState<'totp' | 'backup'>('totp')
  const [code, setCode] = useState('')
  const [backupCode, setBackupCode] = useState('')
  const [pending, setPending] = useState(false)
  const [transportError, setTransportError] = useState<string | null>(null)
  const [serverError, setServerError] = useState(false)
  const [override, setOverride] = useState<MfaChallengeStatus | null>(null)
  const [resetRequested, setResetRequested] = useState(false)
  const [supportOpened, setSupportOpened] = useState(false)

  const codeRef = useRef<HTMLInputElement>(null)
  const lockAlertRef = useRef<HTMLDivElement>(null)
  const noticeRef = useRef<HTMLDivElement>(null)

  const query = useQuery({
    queryKey: ['auth', 'mfa-challenge'],
    queryFn: getMfaChallengeStatus,
    retry: false,
  })

  const status = override ?? query.data ?? null

  /**
   * No session here means the half-authenticated state was discarded — spec
   * "session expiry mid-challenge". The attempt count survives server-side, so a
   * reload cannot be used to evade a lockout.
   */
  useEffect(() => {
    if (query.isSuccess && query.data === null) {
      navigate({ to: '/login', search: { error: 'session_timeout' }, replace: true })
    }
  }, [navigate, query.data, query.isSuccess])

  // The lock deadline is absolute, so the countdown re-syncs after a reload or
  // a reconnect instead of restarting.
  const lockedUntilMs = useMemo(() => {
    if (!status?.lockedUntil) return null
    const at = new Date(status.lockedUntil).getTime()
    return Number.isNaN(at) ? null : at
  }, [status?.lockedUntil])

  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const { seconds: lockSeconds } = useCountdown(lockedUntilMs)
  const locked = status
    ? (lockedUntilMs != null && isLocked(status, nowMs)) || lockSeconds > 0
    : false
  const liftsAt = status ? lockLiftsAt(status) : null

  const notice = useMemo(() => {
    if (!status) return null
    return challengeNotice({
      status: locked ? status : { ...status, lockedUntil: null },
      nowMs,
      mode,
      online,
      serverError,
    })
  }, [status, locked, nowMs, mode, online, serverError])

  function applyResult(result: MfaVerifyResult) {
    switch (result.status) {
      case 'verified':
        navigate({ to: '/dashboard', replace: true })
        return
      case 'session_expired':
        navigate({ to: '/login', search: { error: 'session_timeout' }, replace: true })
        return
      case 'locked':
        setOverride((current) => ({
          attemptsUsed: current?.attemptsUsed ?? 5,
          lockedUntil: result.lockedUntil,
          otherAdminAvailable: current?.otherAdminAvailable ?? false,
          otherAdminName: current?.otherAdminName ?? null,
          policyRequired: current?.policyRequired,
        }))
        return
      case 'invalid_code':
        // A wrong code clears the TOTP field. A lockout does **not** — the
        // spec keeps the typed value so it can be resubmitted the moment the
        // lock lifts.
        if (mode === 'totp') setCode('')
        void query.refetch()
        codeRef.current?.focus()
        return
      case 'server_error':
        // Spec: a 5xx is never counted as a failed attempt.
        setServerError(true)
        return
    }
  }

  async function handleVerify(value: string) {
    const trimmed = value.trim()
    if (!trimmed || pending || locked || !online) return

    setPending(true)
    setServerError(false)
    setTransportError(null)

    try {
      applyResult(await verifyMfaChallenge({ data: { code: trimmed, mode } }))
    } catch {
      setTransportError("We couldn't check that code — nothing was consumed. Try again.")
      codeRef.current?.focus()
    } finally {
      setPending(false)
    }
  }

  async function handleAdminReset() {
    try {
      await requestAdminMfaReset()
      setResetRequested(true)
    } catch {
      setTransportError("We couldn't send that request. Try again.")
    }
  }

  async function handleSupportRecovery() {
    try {
      await requestSupportMfaRecovery()
      setSupportOpened(true)
    } catch {
      setTransportError("We couldn't open the request. Try again.")
    }
  }

  function switchMode(next: 'totp' | 'backup') {
    setMode(next)
    setCode('')
    setBackupCode('')
    setServerError(false)
    setTransportError(null)
  }

  if (query.isPending || !status) {
    return (
      <Card>
        <CardHeader>
          <div className="size-10 animate-pulse rounded-xl bg-muted" aria-hidden="true" />
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-11 w-full" />
        </CardContent>
      </Card>
    )
  }

  // Spec: the input is disabled with a reason while offline — codes are
  // short-lived, so nothing is queued.
  const inputDisabled = pending || !online

  return (
    <Card>
      <CardHeader>
        <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <HugeiconsIcon icon={LockKeyholeIcon} size={20} strokeWidth={1.5} aria-hidden="true" />
        </div>
        <CardTitle className="text-lg font-semibold">Two-factor authentication</CardTitle>
        <CardDescription>
          {mode === 'totp'
            ? 'Enter the 6-digit code from your authenticator app.'
            : 'Enter one of your backup codes. Each code works once.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {!online && <OfflineBanner message="You're offline. 2FA needs a connection." />}

        {locked ? (
          // Spec: on lockout, focus moves to the lockout message container and
          // the input becomes disabled.
          <div
            ref={lockAlertRef}
            role="alert"
            tabIndex={-1}
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 focus-visible:outline-none"
          >
            <p className="text-sm font-medium text-destructive">
              Locked for 15 minutes
              {liftsAt ? ` — try again at ${formatClockTime(liftsAt)}.` : '.'}
            </p>
            <p aria-live="polite" aria-atomic="true" className="mt-1 text-sm text-muted-foreground">
              {lockSeconds > 0 ? `${formatClock(lockSeconds)} remaining.` : null}
            </p>
          </div>
        ) : (
          <div
            ref={noticeRef}
            tabIndex={-1}
            aria-live={notice?.tone === 'warning' ? 'polite' : undefined}
            className="focus-visible:outline-none"
          >
            <ErrorMessage
              message={transportError ?? notice?.message ?? ''}
              destructive={notice?.tone !== 'warning'}
            />
          </div>
        )}

        {mode === 'totp' ? (
          <div className="flex flex-col items-center gap-2">
            <MfaInput
              ref={codeRef}
              value={code}
              onChange={(value) => {
                setCode(value)
                setServerError(false)
                if (value.length === 6 && !pending) void handleVerify(value)
              }}
              disabled={inputDisabled || locked}
            />
            <Button
              className="w-full"
              size="lg"
              disabled={code.length !== 6 || inputDisabled || locked}
              onClick={() => void handleVerify(code)}
            >
              {pending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Verifying…
                </>
              ) : (
                'Verify'
              )}
            </Button>
            <p className="text-xs text-muted-foreground">Codes rotate every 30 seconds.</p>
          </div>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void handleVerify(backupCode)
            }}
          >
            <Field>
              <FieldLabel htmlFor="backup-code">Backup code</FieldLabel>
              <Input
                id="backup-code"
                value={backupCode}
                onChange={(event) => setBackupCode(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="x4k9-2mqw"
                className="h-11 font-mono"
                disabled={inputDisabled || locked}
              />
            </Field>
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={!backupCode.trim() || inputDisabled || locked}
            >
              {pending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Verifying…
                </>
              ) : (
                'Use backup code'
              )}
            </Button>
          </form>
        )}

        <Button
          variant="link"
          size="sm"
          className="self-center"
          onClick={() => switchMode(mode === 'totp' ? 'backup' : 'totp')}
        >
          {mode === 'totp'
            ? "Can't access your app? Use a backup code"
            : 'Use your authenticator app instead'}
        </Button>

        {locked ? (
          <RecoveryPanel
            otherAdminAvailable={status.otherAdminAvailable}
            otherAdminName={status.otherAdminName}
            resetRequested={resetRequested}
            supportOpened={supportOpened}
            onRequestAdminReset={() => void handleAdminReset()}
            onOpenSupport={() => void handleSupportRecovery()}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

/**
 * Spec S-0.3: exactly one of these is offered, chosen by whether a second
 * verified Admin is reachable. No state offers only "contact your Admin".
 */
function RecoveryPanel({
  otherAdminAvailable,
  otherAdminName,
  resetRequested,
  supportOpened,
  onRequestAdminReset,
  onOpenSupport,
}: {
  otherAdminAvailable: boolean
  otherAdminName?: string | null
  resetRequested: boolean
  supportOpened: boolean
  onRequestAdminReset: () => void
  onOpenSupport: () => void
}) {
  if (otherAdminAvailable) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-lg border bg-muted/40 p-3">
        <p className="text-sm text-muted-foreground">
          {resetRequested
            ? `Awaiting ${otherAdminName ?? 'an Admin'} — check their notifications. Requesting again replaces this request.`
            : `${otherAdminName ?? 'Another Admin'} can reset your authenticator. They're notified in-app and on Telegram.`}
        </p>
        <Button size="sm" variant="outline" onClick={onRequestAdminReset}>
          <HugeiconsIcon icon={UserSearch01Icon} data-icon="inline-start" />
          {resetRequested ? 'Request again' : 'Request an admin reset'}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border bg-muted/40 p-3">
      <p className="text-sm text-muted-foreground">{onlyAdminRecoveryMessage()}</p>
      {supportOpened ? (
        <p className="text-sm font-medium text-success-fg">
          Request sent. Support verifies your identity and opens a 24-hour window.
        </p>
      ) : null}
      <Button size="sm" variant="outline" onClick={onOpenSupport} disabled={supportOpened}>
        <HugeiconsIcon icon={LifebuoyIcon} data-icon="inline-start" />
        {supportOpened ? 'Request sent' : 'Open a support request'}
      </Button>
    </div>
  )
}
