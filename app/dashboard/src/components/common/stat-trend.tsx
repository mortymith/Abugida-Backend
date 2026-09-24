import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, ArrowUp01Icon } from '@hugeicons/core-free-icons'
import { cn } from 'cn'

/**
 * Delta trend indicator used by KPI/stat cards (S-1.1, S-1.2).
 * Status is never color-only: direction pairs an arrow icon with text and
 * `tabular-nums` numerals (spec 11).
 */
interface StatTrendProps {
  /** Percentage change vs the comparison period, e.g. 23.5 for +23.5%. */
  deltaPct: number | null | undefined
  srLabel?: string
  className?: string
}

export function StatTrend({ deltaPct, srLabel, className }: StatTrendProps) {
  if (deltaPct == null || !Number.isFinite(deltaPct)) {
    return <span className={cn('text-xs text-muted-foreground', className)}>—</span>
  }

  const isUp = deltaPct >= 0
  const Icon = isUp ? ArrowUp01Icon : ArrowDown01Icon
  const rounded =
    Math.abs(deltaPct) >= 10
      ? Math.round(Math.abs(deltaPct))
      : Math.round(Math.abs(deltaPct) * 10) / 10

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums',
        isUp ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
        className,
      )}
    >
      <HugeiconsIcon icon={Icon} size={12} strokeWidth={2} aria-hidden="true" />
      <span>
        {isUp ? '+' : '−'}
        {rounded}%
      </span>
      {srLabel ? <span className="sr-only">{srLabel}</span> : null}
    </span>
  )
}
