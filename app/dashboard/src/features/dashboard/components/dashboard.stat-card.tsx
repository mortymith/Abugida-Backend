import { useState } from 'react'
import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { Button } from '#/components/ui/button'
import { StatTrend } from '#/components/common/stat-trend'
import { HelpPanel } from '#/features/support'
import { formatCurrency, formatInteger, formatPercent, formatRating } from '#/lib/format'
import { cn } from 'cn'
import type { KpiMetric } from '../dashboard.types'
import { shortComparisonLabel } from '../dashboard.metric-math'

interface StatCardProps {
  metric: KpiMetric
  /** Named comparison basis, e.g. "previous 30 days". Printed under the delta. */
  comparisonLabel?: string
  /** `false` when the screen's Compare toggle is off — the delta reads `—`. */
  compareEnabled?: boolean
  /** Retry for **this card only** (spec S-1.1 per-card partial failure). */
  onRetry?: () => void
  className?: string
}

function formatValue(metric: KpiMetric): string {
  if (metric.value == null) return '—'
  switch (metric.format) {
    case 'currency':
      return formatCurrency(metric.value)
    case 'rating':
      return formatRating(metric.value)
    case 'percent':
      return formatPercent(metric.value)
    case 'hours':
      return `${formatRating(metric.value)} hrs`
    default:
      return formatInteger(metric.value)
  }
}

/**
 * KPI stat card (S-1.1 stats row / S-1.2 summary cards).
 *
 * The contract the spec pins down, all of it visible in the rendered card:
 *
 * - **The comparison basis is named.** Every delta says which period it is
 *   measured against, so the number in a screenshot is interpretable on its own.
 * - **`—` means "not measured", `0%` means "measured, unchanged".** The card
 *   never renders a delta it cannot support.
 * - **A redacted card explains itself.** Without `finance.view_revenue` the
 *   figure is absent from the payload, and the card says who can see it instead
 *   of showing a bare dash.
 * - **A failed card fails alone**, with its own retry.
 */
export function StatCard({
  metric,
  comparisonLabel,
  compareEnabled = true,
  onRetry,
  className,
}: StatCardProps) {
  const [helpOpen, setHelpOpen] = useState(false)

  if (metric.availability === 'error') {
    return (
      <Card className={cn('gap-2 py-5', className)}>
        <CardHeader className="px-5">
          <span className="text-sm font-medium text-muted-foreground">{metric.label}</span>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-2 px-5">
          <p className="text-sm text-destructive">{metric.note ?? 'This metric could not load.'}</p>
          {onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  if (metric.restricted) {
    return (
      <Card className={cn('gap-2 py-5', className)}>
        <CardHeader className="px-5">
          <span className="text-sm font-medium text-muted-foreground">{metric.label}</span>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-2 px-5">
          <p className="text-2xl font-bold tabular-nums">Restricted</p>
          <p className="text-pretty text-xs text-muted-foreground">
            {metric.note ?? 'This figure is limited to roles that hold the permission.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => setHelpOpen(true)}>
            Ask an Admin for access
          </Button>
          <HelpPanel open={helpOpen} onOpenChange={setHelpOpen} />
        </CardContent>
      </Card>
    )
  }

  const basis = comparisonLabel ? shortComparisonLabel(comparisonLabel) : null

  return (
    <Card className={cn('gap-1 py-5', className)}>
      <CardHeader className="px-5">
        <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
          {metric.label}
          {metric.note ? (
            <span
              tabIndex={0}
              role="note"
              aria-label={metric.note}
              title={metric.note}
              className="inline-flex size-4 cursor-help items-center justify-center rounded-full border text-[10px] leading-none text-muted-foreground"
            >
              i
            </span>
          ) : null}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 px-5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-2xl font-bold tabular-nums">{formatValue(metric)}</p>
          <StatTrend
            deltaPct={compareEnabled ? metric.deltaPct : null}
            srLabel={`${metric.label} change vs ${comparisonLabel ?? 'the previous period'}`}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {compareEnabled && basis ? basis : 'Comparison off'}
        </p>
      </CardContent>
    </Card>
  )
}

export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('gap-3 py-5', className)}>
      <CardHeader className="px-5">
        <Skeleton className="h-4 w-20" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-5">
        <div className="flex items-baseline justify-between gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-3 w-28" />
      </CardContent>
    </Card>
  )
}
