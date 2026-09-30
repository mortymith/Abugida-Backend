import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Key01Icon, Tick02Icon } from '@hugeicons/core-free-icons'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Field, FieldError, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Spinner } from '#/components/ui/spinner'
import { cn } from '#/lib/utils'
import { claimInvite } from '#/features/auth/server/auth.signin'
import { CLAIM_CODE_LENGTH, claimFailureMessage, isClaimCode } from '../auth.invite-claim'
import { stashPendingClaimTicket } from '../auth.pending-claim'

/**
 * S-0.1 action 3 — "Sign in with an invite link".
 *
 * The spec's delivery rule (Part 11 § Notification Delivery) requires a
 * **Telegram-safe** invite: a claimable `/invite/:token` link or an
 * 8-character code. A user authenticated by Telegram may have no email address
 * at all, so nothing here collects or displays one, and no invalid state reveals
 * who consumed an invitation.
 *
 * The claim runs on the login screen, which is *before* a session exists, so the
 * server answers a valid reference with a signed ticket rather than consuming
 * the invite outright — a user who then fails to sign in has not forfeited
 * their seat. The ticket is stashed and redeemed by `redeemPendingClaim` once
 * the provider redirect lands inside the app (`routes/_app/route.tsx`).
 */
export function InviteClaim({
  initialToken = null,
  onNotice,
}: {
  initialToken?: string | null
  /** Lets the login screen surface an invalid claim in its error region. */
  onNotice?: (message: string) => void
}) {
  const [open, setOpen] = useState(Boolean(initialToken))
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<'idle' | 'claimed' | 'invalid'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  // Arriving on /login?invite=… opens the form and pre-fills the reference.
  useEffect(() => {
    if (initialToken) {
      setCode(initialToken.toUpperCase())
      inputRef.current?.focus()
    }
  }, [initialToken])

  const trimmed = code.trim()
  // A token is a long opaque string; a code is exactly 8 characters. The server
  // normalizes independently, so this is presentation, not validation — it only
  // decides whether the button is live.
  const isCode = isClaimCode(trimmed)
  const isToken = trimmed.length > CLAIM_CODE_LENGTH
  const canSubmit = isToken || isCode

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit || pending) return

    setPending(true)
    try {
      const claim = await claimInvite({
        data: isCode ? { code: trimmed, token: null } : { token: trimmed, code: null },
      })

      if (claim.status === 'claimed') {
        setResult('claimed')
        return
      }

      if (claim.status === 'pending_signin') {
        stashPendingClaimTicket(claim.ticket)
        setResult('claimed')
        return
      }

      // `not_found`, `expired` and `consumed` are deliberately indistinguishable
      // here: a consumed invite must never reveal who consumed it.
      setResult('invalid')
      onNotice?.(claimFailureMessage())
    } catch {
      setResult('idle')
      onNotice?.("We couldn't check that invitation. Nothing was changed. Try again.")
    } finally {
      setPending(false)
    }
  }

  if (!open) {
    return (
      <Button variant="link" size="sm" onClick={() => setOpen(true)}>
        Sign in with an invite link
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-2" noValidate>
      <FieldGroup className="gap-2">
        <Field data-invalid={result === 'invalid' ? true : undefined}>
          <FieldLabel htmlFor="invite-reference" className="text-xs text-muted-foreground">
            Invite link or 8-character code
          </FieldLabel>
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              id="invite-reference"
              value={code}
              onChange={(event) => {
                setCode(event.target.value)
                setResult('idle')
              }}
              placeholder="Abugida-2026 or 4KD9P2QW"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={result === 'invalid' ? true : undefined}
              aria-describedby={result === 'invalid' ? 'invite-reference-error' : undefined}
              className="h-9 font-mono text-xs"
            />
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={!canSubmit || pending}
              className="h-9 shrink-0"
            >
              {pending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Checking
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={Key01Icon} data-icon="inline-start" />
                  Claim
                </>
              )}
            </Button>
          </div>
          {result === 'invalid' ? (
            <FieldError id="invite-reference-error">{claimFailureMessage()}</FieldError>
          ) : null}
          {result === 'claimed' ? (
            <p className={cn('flex items-center gap-1.5 text-xs text-success-fg')}>
              <HugeiconsIcon icon={Tick02Icon} className="size-3.5" aria-hidden="true" />
              Invitation accepted — choose a provider above to finish signing in.
            </p>
          ) : null}
        </Field>
      </FieldGroup>
    </form>
  )
}
