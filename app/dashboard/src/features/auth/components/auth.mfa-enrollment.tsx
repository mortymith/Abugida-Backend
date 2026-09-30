import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import QRCode from 'qrcode'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CheckmarkCircle01Icon,
  Copy01Icon,
  Download01Icon,
  LockKeyholeIcon,
  RefreshIcon,
  ShieldCheckIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'

import { MfaInput } from '#/features/auth/components/auth.mfa-input'
import { ErrorMessage } from '#/components/common/error-message'
import { OfflineBanner } from '#/components/common/offline-banner'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { Spinner } from '#/components/ui/spinner'
import { Stepper } from '#/components/ui/stepper'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { toast } from '#/components/common/toast'
import { useOnline } from '#/hooks/use-online'
import {
  confirmEnrollment,
  disableEnrollment,
  getEnrollmentStatus,
  regenerateBackupCodes,
  replaceAuthenticator,
  startEnrollment,
} from '#/features/auth/server/auth.enrollment'
import {
  AUTHENTICATOR_APPS,
  backupCodesAnnouncement,
  backupCodesFileName,
  formatBackupCodeFile,
  formatManualKey,
  nextStep,
  partialFailureMessage,
  stepAnnouncement,
  stepNumber,
  stillOffNotice,
  verifyFailureMessage,
  ENROLLMENT_STEPS,
} from '../auth.mfa-enrollment'
import type { EnrollmentStep } from '../auth.mfa-enrollment'
import type { EnrollmentEntryPoint } from '../auth.events'
import type { StartEnrollmentResult } from '#/features/auth/server/auth.enrollment.impl.server'

const STATUS_QUERY_KEY = ['auth', 'mfa-enrollment'] as const

/**
 * S-0.4 Multi-Factor Enrollment — the one place a user turns MFA **on**.
 *
 * The invariant the whole screen exists to protect: **the toggle does not flip
 * until the 6-digit code verifies** (spec acceptance criterion 1). So
 * `confirmEnrollment` is the only call that can enable MFA, and every failure
 * path leaves the account protected-by-nothing *and says so*, rather than
 * implying a half-finished enrolment.
 *
 * The manual key is rendered in full, always, next to the QR — not behind a
 * "can't scan?" toggle — because a camera failure is common and the recovery
 * path must not depend on a re-render of a QR image.
 */
export function MfaEnrollment() {
  const queryClient = useQueryClient()
  const online = useOnline()

  const [step, setStep] = useState<EnrollmentStep>('scan')
  const [secret, setSecret] = useState('')
  const [totpUri, setTotpUri] = useState('')
  const [code, setCode] = useState('')
  const [qr, setQr] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transportError, setTransportError] = useState(false)
  const [copied, setCopied] = useState<'key' | 'all' | null>(null)
  const [confirm, setConfirm] = useState<'regenerate' | 'replace' | 'disable' | null>(null)
  /** Verify presses in the current flow — the spec's `step3_attempts`. */
  const confirmAttempts = useRef(0)

  const codeRef = useRef<HTMLInputElement>(null)
  const copyRef = useRef<HTMLButtonElement>(null)
  const codesHeadingRef = useRef<HTMLHeadingElement>(null)

  const status = useQuery({
    queryKey: STATUS_QUERY_KEY,
    queryFn: getEnrollmentStatus,
    retry: false,
  })

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY })
  }, [queryClient])

  // The QR is decorative; the manual key beside it is the accessible path.
  useEffect(() => {
    if (!totpUri) {
      setQr(null)
      return
    }
    let cancelled = false
    void QRCode.toDataURL(totpUri, { width: 200, margin: 1 })
      .then((url) => {
        if (!cancelled) setQr(url)
      })
      .catch(() => {
        if (!cancelled) setQr(null)
      })
    return () => {
      cancelled = true
    }
  }, [totpUri])

  /**
   * `begin` is only ever reached by a user choosing to enrol, so `'replace'`
   * is excluded here by construction — replacement goes through
   * `replaceAuthenticator`, which has its own spec event.
   */
  async function begin(entryPoint: Exclude<EnrollmentEntryPoint, 'replace'> = 'settings') {
    setPending(true)
    setError(null)
    setTransportError(false)
    // A new flow is a new step-3 attempt count; the spec measures attempts per
    // enrolment, not per session.
    confirmAttempts.current = 0
    try {
      const result: StartEnrollmentResult = await startEnrollment({ data: { entryPoint } })
      if (result.status !== 'started') {
        setError(
          result.reason === 'already_enrolled'
            ? 'An authenticator is already enrolled on this account.'
            : `We couldn't turn on 2FA — nothing was changed. Try again. Reference: ${result.requestId}`,
        )
        setTransportError(result.reason !== 'already_enrolled')
        return
      }
      setSecret(result.secret)
      setTotpUri(result.totpUri)
      setQr(null)
      setStep('scan')
    } catch {
      setError("We couldn't turn on 2FA — nothing was changed. Try again.")
      setTransportError(true)
    } finally {
      setPending(false)
    }
  }

  async function confirmCode() {
    if (code.length !== 6 || pending) return

    setPending(true)
    setError(null)
    setTransportError(false)
    confirmAttempts.current += 1
    try {
      const result = await confirmEnrollment({
        data: { code, clientTimestampMs: Date.now(), attempts: confirmAttempts.current },
      })

      if (result.status === 'enabled') {
        setCode('')
        await loadBackupCodes('initial')
        setStep('backup_codes')
        refresh()
        return
      }

      // MFA stays **off** on every one of these. The step does not advance.
      setCode('')
      setError(
        result.status === 'clock_skew'
          ? verifyFailureMessage('clock_skew')
          : result.status === 'server_error'
            ? `We couldn't turn on 2FA — nothing was changed. Try again. Reference: ${result.requestId}`
            : verifyFailureMessage('invalid'),
      )
      setTransportError(result.status === 'server_error')
      codeRef.current?.focus()
    } catch {
      setError("You're offline — nothing was changed. Try again when you're back.")
      setTransportError(true)
    } finally {
      setPending(false)
    }
  }

  /**
   * `initial` is the first issue, which the spec treats as *shown*; `regenerate`
   * is the maintenance action that invalidates the previous set. The server
   * cannot tell them apart on its own, and conflating them would report a first
   * enrolment as a regeneration that destroyed 10 codes.
   */
  async function loadBackupCodes(reason: 'initial' | 'regenerate' = 'initial') {
    try {
      const result = await regenerateBackupCodes({ data: { reason } })
      if (result.status === 'regenerated') {
        setBackupCodes(result.backupCodes)
        setAcknowledged(false)
      } else {
        setBackupCodes(null)
        setError(partialFailureMessage())
      }
    } catch {
      setBackupCodes(null)
      setError(partialFailureMessage())
    }
  }

  async function copy(text: string, which: 'key' | 'all') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      setError("Couldn't copy to the clipboard. Select the text and copy it manually.")
    }
  }

  function download() {
    if (!backupCodes) return
    const blob = new Blob([formatBackupCodeFile(backupCodes)], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = backupCodesFileName()
    anchor.click()
    URL.revokeObjectURL(url)
  }

  // ── Maintenance actions (post-enrolment) ────────────────────────────────
  async function runMaintenance(kind: 'regenerate' | 'replace' | 'disable') {
    setConfirm(null)
    setPending(true)
    setError(null)
    try {
      if (kind === 'regenerate') {
        await loadBackupCodes('regenerate')
        setStep('backup_codes')
        setAcknowledged(false)
        return
      }
      if (kind === 'replace') {
        // The old authenticator stays active until the new one verifies, so a
        // mis-scan cannot lock the user out (spec S-0.4 action 6).
        setSecret('')
        setTotpUri('')
        setCode('')
        const result: StartEnrollmentResult = await replaceAuthenticator()
        if (result.status !== 'started') {
          setError(
            result.reason === 'already_enrolled'
              ? 'An authenticator is already enrolled on this account.'
              : `We couldn't start again — nothing was changed. Reference: ${result.requestId}`,
          )
          setTransportError(result.reason !== 'already_enrolled')
          return
        }
        setSecret(result.secret)
        setTotpUri(result.totpUri)
        setQr(null)
        setStep('scan')
        return
      }
      await disableEnrollment()
      resetFlow()
      refresh()
      toast.success('Two-factor authentication is off.')
    } catch {
      setError("We couldn't complete that. Nothing was changed. Try again.")
      setTransportError(true)
    } finally {
      setPending(false)
    }
  }

  function resetFlow() {
    setStep('scan')
    setSecret('')
    setTotpUri('')
    setQr(null)
    setCode('')
    setBackupCodes(null)
    setAcknowledged(false)
  }

  // ── States ──────────────────────────────────────────────────────────────
  if (status.isPending) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="size-10 rounded-xl" />
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-11 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (status.data?.selfServiceBlocked) {
    // Spec 403: the whole surface is replaced, with the QR and key **absent** —
    // not rendered behind a disabled button.
    return (
      <Card>
        <CardHeader>
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <HugeiconsIcon icon={LockKeyholeIcon} size={20} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <CardTitle className="text-lg font-semibold">Two-factor authentication</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your workspace manages two-factor for your role. Ask an Admin to enable it.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (status.data?.enabled && step === 'scan' && !secret) {
    return <EnrolledStatus onAction={setConfirm} pending={pending} />
  }

  const manualKey = formatManualKey(secret)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold">
              {step === 'backup_codes'
                ? 'Two-factor authentication is on'
                : 'Two-factor authentication — Setup'}
            </CardTitle>
            <CardDescription>
              {step === 'backup_codes'
                ? 'Save these codes now. This is the only time we will show them.'
                : 'Use any authenticator app. No password is ever involved.'}
            </CardDescription>
          </div>
        </div>
        {step !== 'backup_codes' ? (
          <Stepper
            steps={[...ENROLLMENT_STEPS.slice(0, 2).map((s) => stepLabel(s))]}
            currentStep={stepNumber(step)}
            className="mt-2"
          />
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {!online && <OfflineBanner />}

        {/* Step changes are announced so a screen-reader user is never guessing. */}
        <p aria-live="polite" className="sr-only">
          {stepAnnouncement(step)}
        </p>

        <div tabIndex={-1} className="focus-visible:outline-none">
          <ErrorMessage message={error ?? ''} destructive={transportError} />
        </div>

        {step === 'scan' ? (
          <section className="flex flex-col gap-4">
            <ol className="flex flex-col gap-3 text-sm">
              <li className="flex gap-2">
                <StepNumber n={1} />
                <span>Add an authenticator app and scan this code.</span>
              </li>
              <li className="flex gap-2">
                <StepNumber n={2} />
                <span>…or enter this key by hand.</span>
              </li>
            </ol>

            <p className="text-xs text-muted-foreground">
              Works with {AUTHENTICATOR_APPS.map((app) => app.label).join(', ')}.
            </p>

            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <div className="flex size-[200px] shrink-0 items-center justify-center rounded-xl border bg-white p-2">
                {qr ? (
                  <img
                    src={qr}
                    alt={`QR code to add ${import.meta.env.VITE_APP_NAME} to your authenticator app`}
                    width={184}
                    height={184}
                    className="size-full"
                  />
                ) : (
                  <Skeleton className="size-[184px]" />
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2">
                <p className="text-sm font-medium">…or enter this key manually</p>
                <p className="text-xs text-muted-foreground">
                  Enter this key by hand in your app. Camera access is not required.
                </p>
                <div className="flex items-center gap-2">
                  {/* Spec: focus lands here on arrival so a keyboard user reaches
                      the recovery path before the QR. */}
                  <code
                    className="flex-1 rounded-lg border bg-muted/50 px-3 py-2 font-mono text-sm tracking-widest select-all"
                    aria-label="Manual setup key"
                  >
                    {pending && !secret
                      ? '····-····-····-····'
                      : manualKey || '····-····-····-····'}
                  </code>
                  <Button
                    ref={copyRef}
                    variant="outline"
                    size="sm"
                    disabled={!secret}
                    onClick={() => void copy(manualKey, 'key')}
                  >
                    <HugeiconsIcon icon={Copy01Icon} data-icon="inline-start" />
                    {copied === 'key' ? 'Copied.' : 'Copy'}
                  </Button>
                </div>
                <Button
                  className="w-full sm:w-auto"
                  size="lg"
                  disabled={!secret || pending}
                  onClick={() => {
                    setStep(nextStep('scan', false))
                    window.setTimeout(() => codeRef.current?.focus(), 0)
                  }}
                >
                  Next: enter the code
                </Button>
              </div>
            </div>

            <StillOffNotice />
          </section>
        ) : null}

        {step === 'confirm' ? (
          <section className="flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code from your app to confirm. Two-factor stays off until this
              succeeds.
            </p>
            <MfaInput
              ref={codeRef}
              value={code}
              onChange={setCode}
              invalid={Boolean(error) && !transportError}
              disabled={pending || !online}
            />
            <Button
              className="w-full"
              size="lg"
              disabled={code.length !== 6 || pending || !online}
              onClick={() => void confirmCode()}
            >
              {pending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Verifying…
                </>
              ) : (
                'Verify and turn on 2FA'
              )}
            </Button>
            <Button variant="link" size="sm" onClick={() => setStep('scan')}>
              Back to the setup key
            </Button>
            <StillOffNotice />
          </section>
        ) : null}

        {step === 'backup_codes' ? (
          <section className="flex flex-col gap-4">
            <p
              ref={codesHeadingRef}
              tabIndex={-1}
              className="text-sm font-medium focus-visible:outline-none"
            >
              {backupCodesAnnouncement(backupCodes ?? [])} Each code works once.
            </p>

            {backupCodes ? (
              <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {backupCodes.map((backup, index) => (
                  <li
                    key={backup}
                    className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm"
                  >
                    <span className="w-5 text-xs text-muted-foreground">{index + 1}.</span>
                    {backup}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-destructive">{partialFailureMessage()}</p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={!backupCodes} onClick={download}>
                <HugeiconsIcon icon={Download01Icon} data-icon="inline-start" />
                Download .txt
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!backupCodes}
                onClick={() => void copy((backupCodes ?? []).join('\n'), 'all')}
              >
                <HugeiconsIcon icon={Copy01Icon} data-icon="inline-start" />
                {copied === 'all' ? 'Copied.' : 'Copy all'}
              </Button>
              {!backupCodes ? (
                <Button
                  size="sm"
                  onClick={() => void loadBackupCodes('regenerate')}
                  disabled={pending}
                >
                  {pending ? 'Generating…' : 'Generate codes again'}
                </Button>
              ) : null}
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                className="mt-0.5 size-4"
              />
              <span>I saved these codes somewhere I can reach them.</span>
            </label>

            {/* The only exits are the acknowledgement and Done — closing the page
                would lose the codes, so Esc does nothing here. */}
            <div className="flex flex-wrap gap-2">
              <Button disabled={!acknowledged} render={<Link to="/settings/profile" />}>
                <HugeiconsIcon icon={Tick02Icon} data-icon="inline-start" />
                Done
              </Button>
              <Button variant="ghost" onClick={() => setConfirm('regenerate')} disabled={pending}>
                <HugeiconsIcon icon={RefreshIcon} data-icon="inline-start" />
                Regenerate backup codes
              </Button>
            </div>
          </section>
        ) : null}

        {step === 'scan' && !secret ? (
          <Button size="lg" className="w-full" disabled={!online} onClick={() => void begin()}>
            {pending ? (
              <>
                <Spinner data-icon="inline-start" />
                Preparing a key…
              </>
            ) : (
              'Set up two-factor'
            )}
          </Button>
        ) : null}
      </CardContent>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        title={
          confirm === 'regenerate'
            ? 'Regenerate your backup codes?'
            : confirm === 'replace'
              ? 'Replace your authenticator?'
              : 'Turn off two-factor authentication?'
        }
        body={
          confirm === 'regenerate'
            ? `This invalidates all ${status.data?.backupCodesRemaining ?? 'current'} existing codes. Any copy you have saved stops working.`
            : confirm === 'replace'
              ? 'Your current authenticator stays active until the new one verifies, so a mis-scan cannot lock you out.'
              : 'Your account will be protected by your sign-in provider alone until you set this up again.'
        }
        confirmLabel={confirm === 'disable' ? 'Turn off 2FA' : 'Continue'}
        destructive={confirm === 'disable'}
        onConfirm={async () => {
          if (confirm) await runMaintenance(confirm)
        }}
      />
    </Card>
  )
}

function stepLabel(step: EnrollmentStep): string {
  return step === 'scan' ? 'Scan or enter the key' : 'Confirm'
}

/**
 * Spec S-0.4: closing at any point leaves MFA **off**, and the screen has to
 * say so — a half-enrolled state must never be implied. Shown until step 3
 * verifies.
 */
function StillOffNotice() {
  const message = stillOffNotice(false)
  if (!message) return null
  return <p className="text-xs font-medium text-warning-fg">{message}</p>
}

function StepNumber({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
    >
      {n}
    </span>
  )
}

/** S-0.4 "Already Enrolled": status and maintenance actions, never a second QR. */
function EnrolledStatus({
  onAction,
  pending,
}: {
  onAction: (kind: 'regenerate' | 'replace' | 'disable') => void
  pending: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex size-10 items-center justify-center rounded-xl bg-success-bg text-success-fg">
          <HugeiconsIcon icon={ShieldCheckIcon} size={20} strokeWidth={1.5} aria-hidden="true" />
        </div>
        <CardTitle className="text-lg font-semibold">Two-factor authentication is on</CardTitle>
        <CardDescription>
          Your account asks for a code from your authenticator app at every sign-in.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="flex items-center gap-2 text-sm text-success-fg">
          <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" aria-hidden="true" />
          Active
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => onAction('replace')}
          >
            Replace authenticator
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => onAction('regenerate')}
          >
            Regenerate backup codes
          </Button>
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => onAction('disable')}>
            Turn off 2FA
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Lost your device? Use a backup code, ask another Admin to reset it, or open a support
          request for a 24-hour recovery window.
        </p>
      </CardContent>
    </Card>
  )
}
