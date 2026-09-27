import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { TrendChart } from '#/features/dashboard/components/dashboard.trend-chart'
import type { MetricAvailability, TrendPoint } from '#/features/dashboard/dashboard.types'
import type { TrendGranularity } from '#/features/dashboard/schemas/dashboard.date-range.schema'

interface AnalyticsChartCardProps {
  title: string
  description?: string
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  availability?: MetricAvailability
  points: TrendPoint[]
  granularity: TrendGranularity
  kind: 'line' | 'bar'
  ariaLabel: string
  colorVar?: string
  emptyTitle?: string
  emptyDescription?: string
  /** Accessible alternative: spec 11 wants charts backed by a data table. */
  table?: React.ReactNode
  /** Custom chart body (e.g. categorical weekday bars); renders instead of TrendChart. */
  children?: React.ReactNode
}

/**
 * Chart card wrapper for the S-5.x screens (S-5.1 completion trend / weekday
 * activity). Isolates loading / error / empty states per section so one slow
 * or failing query never blanks the whole screen.
 */
export function AnalyticsChartCard({
  title,
  description,
  isLoading,
  isError,
  onRetry,
  availability,
  points,
  granularity,
  kind,
  ariaLabel,
  colorVar,
  emptyTitle = 'No data available for the selected period.',
  emptyDescription = 'Try widening or changing the date range.',
  table,
  children,
}: AnalyticsChartCardProps) {
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </CardHeader>
      <CardContent className="px-5">
        {isLoading ? (
          <Skeleton className="h-[280px] w-full" aria-hidden="true" />
        ) : isError ? (
          <RetryErrorState title="Unable to load analytics. Retry?" onRetry={onRetry} />
        ) : availability === 'unsupported' ? (
          <EmptyState variant="compact" title="Not available yet." description={description} />
        ) : points.length === 0 && children == null ? (
          <EmptyState variant="compact" title={emptyTitle} description={emptyDescription} />
        ) : children != null ? (
          children
        ) : (
          <>
            <div role="img" aria-label={ariaLabel}>
              <TrendChart
                points={points}
                granularity={granularity}
                kind={kind}
                ariaLabel={ariaLabel}
                colorVar={colorVar}
              />
            </div>
            {table ? (
              <details className="mt-2 text-xs text-muted-foreground">{table}</details>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
