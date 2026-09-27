import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { StatTrend } from '#/components/common/stat-trend'
import { formatCurrency, formatInteger, formatPercent, formatRating } from '#/lib/format'
import { cn } from 'cn'
import type { KpiMetric } from '../dashboard.types'

/**
 * KPI stat card (S-1.1 stats row / S-1.2 summary cards).
 * Availability semantics per plan §4.5:
 * - 'ok'         → value + delta
 * - 'no_data'    → "—" with the label intact
 * - 'unsupported'→ "—" + explanatory tooltip (never a fake number)
 */
export function StatCard({ metric, className }: { metric: KpiMetric; className?: string }) {
  const value =
    metric.availability === 'unsupported' || metric.value == null
      ? '—'
      : metric.format === 'currency'
        ? formatCurrency(metric.value)
        : metric.format === 'rating'
          ? formatRating(metric.value)
          : metric.format === 'percent'
            ? formatPercent(metric.value)
            : metric.format === 'hours'
              ? `${formatRating(metric.value)} hrs`
              : formatInteger(metric.value)

  const body = (
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
      <CardContent className="flex items-baseline justify-between gap-2 px-5">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <StatTrend
          deltaPct={metric.deltaPct}
          srLabel={`${metric.label} change vs previous period`}
        />
      </CardContent>
    </Card>
  )

  return body
}

export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('gap-3 py-5', className)}>
      <CardHeader className="px-5">
        <Skeleton className="h-4 w-20" />
      </CardHeader>
      <CardContent className="flex items-baseline justify-between gap-2 px-5">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </CardContent>
    </Card>
  )
}
