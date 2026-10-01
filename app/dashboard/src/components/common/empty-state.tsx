import { cn } from 'cn'
import type { ReactNode } from 'react'

/**
 * Standardized empty state (spec S-7.3).
 *
 * - `standard`: module has no records at all → icon + message + CTA.
 * - `compact`: records exist but a filter/search excluded them → lighter
 *   "No matches" message + "Clear filters" action (spec 11 Empty vs Zero-Result).
 *
 * The title is a **heading**, not a paragraph. A screen whose only content is an
 * empty state used to expose no heading at all, so a screen-reader user landing
 * there heard an unlabelled message; `level={2}` keeps the outline correct under
 * the page's `<h1>` and `level={3}` under a card's title.
 */
interface EmptyStateProps {
  variant?: 'standard' | 'compact'
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  /** Heading level for the title. Defaults to `2`. */
  level?: 2 | 3
  className?: string
}

export function EmptyState({
  variant = 'standard',
  icon,
  title,
  description,
  action,
  level = 2,
  className,
}: EmptyStateProps) {
  const Heading = level === 2 ? 'h2' : 'h3'

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center',
          className,
        )}
      >
        <Heading className="text-sm font-medium">{title}</Heading>
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
      <Heading className="text-base font-semibold">{title}</Heading>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
