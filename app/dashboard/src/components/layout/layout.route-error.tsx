import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Alert02Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { Button, buttonVariants } from '#/components/ui/button'
import { getVisibleNavItems } from '#/features/navigation'
import { HelpPanel } from '#/features/support'
import { useWorkspaceRole } from '#/features/workspaces'
import { cn } from '#/lib/utils'

/**
 * `errorComponent` for the authenticated layout.
 *
 * The spec is explicit that a 403 or 404 is rendered **inside the shell**: the
 * sidebar, header and breadcrumb stay mounted and interactive, so a user who
 * followed an old link can navigate somewhere they *are* allowed to go. Nothing
 * here signs the user out and never blanks the shell.
 *
 * Copy follows spec 11 § Resilience States: the message names the resource, a
 * request ID makes a support conversation actionable, and every state offers a
 * way out — contacting support is never the only affordance on a problem the
 * user can resolve themselves.
 */
export function AppRouteError({ error, reset }: { error: unknown; reset: () => void }) {
  const role = useWorkspaceRole()
  const failure = error instanceof Error ? error : new Error(String(error))
  const requestId = readRequestId(failure)
  const status = readStatus(failure)
  const notFound = status === 404
  const help = useHelpPanel()

  // The first destination the signed-in role may open, so "Back to {module}"
  // always exists even when the failure happened on their only module.
  const fallbackModule = getVisibleNavItems(role)[0] ?? {
    to: '/dashboard',
    label: 'Dashboard',
  }

  // The error state *is* the screen, so it takes focus — the shell chrome does
  // not (S-A.1 · Focus on arrival).
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 py-10">
      <HugeiconsIcon
        icon={notFound ? Cancel01Icon : Alert02Icon}
        strokeWidth={1.5}
        className="size-8 text-muted-foreground"
      />
      <h1 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-bold outline-none">
        {notFound ? 'We couldn’t find that' : 'You don’t have access to this'}
      </h1>
      <p className="text-pretty text-muted-foreground">
        {notFound
          ? 'This course was deleted, or you followed an old link.'
          : `You don’t have access to ${describeResource(failure)}.`}
      </p>
      <p className="text-xs text-muted-foreground">Reference: {requestId}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Link to={fallbackModule.to} className={cn(buttonVariants({ size: 'sm' }))}>
          Back to {fallbackModule.label}
        </Link>
        {!notFound ? (
          <Button variant="ghost" size="sm" onClick={reset}>
            Try again
          </Button>
        ) : null}
        {/* S-7.4: the "Ask an Admin for access" route. */}
        <Button variant="ghost" size="sm" onClick={() => help.setOpen(true)}>
          Ask an admin for access
        </Button>
        <HelpPanel open={help.open} onOpenChange={help.setOpen} />
      </div>
    </div>
  )
}

function useHelpPanel() {
  const [open, setOpen] = useState(false)
  return { open, setOpen }
}

function readStatus(error: Error): number {
  const status = (error as Error & { status?: unknown }).status
  return typeof status === 'number' ? status : 0
}

/** Name the resource from the failure, so the message is actionable. */
function describeResource(error: Error): string {
  const message = error.message.toLowerCase()
  if (message.includes('course')) return 'this course'
  if (message.includes('student')) return 'this student'
  if (message.includes('asset')) return 'this content asset'
  if (message.includes('workspace') || message.includes('organization')) return 'this workspace'
  if (message.includes('revenue')) return 'revenue'
  return 'this screen'
}

function readRequestId(error: Error): string {
  const withId = error as Error & { requestId?: unknown; data?: { requestId?: unknown } }
  if (typeof withId.requestId === 'string') return withId.requestId
  if (typeof withId.data?.requestId === 'string') return withId.data.requestId
  return 'unavailable'
}
