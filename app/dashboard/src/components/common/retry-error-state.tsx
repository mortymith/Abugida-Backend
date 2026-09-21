import { Button } from '#/components/ui/button'
import { cn } from 'cn'

/**
 * Error state with retry (spec S-1.1 / S-1.2: "Unable to load …. Retry?").
 * Wraps a query refetch so the retry affordance is consistent everywhere.
 */
interface RetryErrorStateProps {
  title?: string
  description?: string
  onRetry: () => void
  isRetrying?: boolean
  className?: string
}

export function RetryErrorState({
  title = 'Unable to load data. Retry?',
  description,
  onRetry,
  isRetrying = false,
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
    </div>
  )
}
