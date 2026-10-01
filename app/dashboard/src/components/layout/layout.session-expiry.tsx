import { useCallback, useEffect, useState } from 'react'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { listDirtySurfaces } from '#/features/auth/auth.dirty-surfaces'
import { useSession } from '#/features/auth'
import { authClient } from '#/lib/auth-client'
import { trackNavEvent } from '#/features/navigation'

/** The spec's warning window: two minutes before the session ends. */
const WARNING_WINDOW_MS = 2 * 60 * 1000
/** Coarse tick; the countdown only needs minute resolution. */
const TICK_MS = 10_000

/**
 * Shell-owned **Session expiry warning** (spec 11 · Resilience States).
 *
 * Two minutes before the session ends, a modal names the surfaces that still
 * hold unsaved work — so the user can finish or save them rather than discover
 * the loss after the fact. The buffers themselves are **preserved**: nothing
 * here discards, and the session is only extended when the user asks for it.
 *
 * The tick is deliberately coarse and pauses while the tab is hidden, matching
 * the badge rule that the shell does no work in a background tab.
 */
export function SessionExpiryWarning() {
  const { data: session } = useSession()
  const expiresAt = session?.session.expiresAt
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [busy, setBusy] = useState(false)

  const readRemaining = useCallback(() => {
    if (!expiresAt) {
      setRemainingMs(null)
      return
    }
    const at = typeof expiresAt === 'string' ? Date.parse(expiresAt) : expiresAt.getTime()
    setRemainingMs(Number.isNaN(at) ? null : at - Date.now())
  }, [expiresAt])

  useEffect(() => {
    readRemaining()
    const timer = setInterval(() => {
      if (document.visibilityState === 'hidden') return
      readRemaining()
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [readRemaining])

  const warning =
    !dismissed && remainingMs != null && remainingMs <= WARNING_WINDOW_MS && remainingMs > 0

  useEffect(() => {
    if (!warning) return
    trackNavEvent('nav.session_expiry_warning_shown', {
      surfaces_count: listDirtySurfaces().length,
    })
  }, [warning])

  async function staySignedIn() {
    setBusy(true)
    try {
      // A round trip to `/get-session` is what better-auth's refresh-on-read
      // policy keys off, so the cookie's age — and with it the expiry — moves.
      await authClient.getSession()
      readRemaining()
    } finally {
      setBusy(false)
      setDismissed(true)
    }
  }

  if (!warning) return null

  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000))
  const dirty = listDirtySurfaces()

  return (
    <Dialog open onOpenChange={(open) => !open && setDismissed(true)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Your session is about to expire</DialogTitle>
          <DialogDescription>
            You’ll be signed out in about {minutes} {minutes === 1 ? 'minute' : 'minutes'}. Anything
            you have saved is safe.
          </DialogDescription>
        </DialogHeader>

        {dirty.length > 0 ? (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium">Unsaved work</p>
            <ul className="mt-1 list-inside list-disc text-muted-foreground">
              {dirty.map((surface) => (
                <li key={surface.label}>{surface.label}</li>
              ))}
            </ul>
            <p className="mt-2 text-muted-foreground">
              Save these before you sign out — we keep them on screen while you come back.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">You have no unsaved changes.</p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setDismissed(true)}>
            Sign out now
          </Button>
          <Button onClick={() => void staySignedIn()} disabled={busy}>
            Stay signed in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
