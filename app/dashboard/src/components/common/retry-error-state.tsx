import { Button } from '#/components/ui/button'
import { cn } from 'cn'

/**
 * Error state with retry (spec S-1.1 / S-1.2: "We couldn't load … — your work is
 * safe." + retry + request ID).
 *
 * `requestId` is the whole reason this component exists as a shared primitive: a
 * support conversation about a failed screen starts with the reference the user
 * can read off the screen, so every error state in the product can offer one.
 */
interface RetryErrorStateProps {
  title?: string
  description?: string
  onRetry: () => void
  isRetrying?: boolean
  /** Reference the user can quote in a support ticket. */
  requestId?: string
  className?: string
}

export function RetryErrorState({
  title = 'Unable to load data. Retry?',
  description,
  onRetry,
  isRetrying = false,
  requestId,
  className,
}: RetryErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-10 text-center',
        className,
      )}
    >
      <p className="text-sm font-semibold">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      <Button variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? 'Retrying…' : 'Retry'}
      </Button>
      {requestId ? <p className="text-xs text-muted-foreground">Reference: {requestId}</p> : null}
    </div>
  )
}

/** Read a request ID off an unknown thrown value, if it carries one. */
export function readRequestId(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined
  const withId = error as Error & { requestId?: unknown; data?: { requestId?: unknown } }
  if (typeof withId.requestId === 'string') return withId.requestId
  if (typeof withId.data?.requestId === 'string') return withId.data.requestId
  return undefined
}
