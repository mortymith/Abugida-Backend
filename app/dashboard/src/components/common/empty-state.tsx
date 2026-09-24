import { cn } from 'cn'
import type { ReactNode } from 'react'

/**
 * Standardized empty state (spec S-7.3).
 *
 * - `standard`: module has no records at all → icon + message + CTA.
 * - `compact`: records exist but a filter/search excluded them → lighter
 *   "No matches" message + "Clear filters" action (spec 11 Empty vs Zero-Result).
 */
interface EmptyStateProps {
  variant?: 'standard' | 'compact'
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  variant = 'standard',
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center',
          className,
        )}
      >
        <p className="text-sm font-medium">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        {action}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg px-6 py-16 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6">
          {icon}
        </div>
      ) : null}
      <p className="text-base font-semibold">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
