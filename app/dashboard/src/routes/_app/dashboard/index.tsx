import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { Button } from '#/components/ui/button'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { StatCard, StatCardSkeleton } from '#/features/dashboard/components/dashboard.stat-card'
import { TrendChart } from '#/features/dashboard/components/dashboard.trend-chart'
import { CoursePerformanceTable } from '#/features/dashboard/components/dashboard.course-performance-table'
import { DateRangePicker } from '#/features/dashboard/components/dashboard.date-range-picker'
import type { DateRangeSelection } from '#/features/dashboard/components/dashboard.date-range-picker'
import {
  overviewQueryOptions,
  coursePerformanceQueryOptions,
} from '#/features/dashboard/dashboard.queries'
import { downloadCsv, buildCsv } from '#/features/dashboard/dashboard.export-csv'
import { toast } from '#/components/common/toast'

const overviewSearchSchema = z.object({
  preset: z.enum(['7d', '30d', '90d', '12mo']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
})

export const Route = createFileRoute('/_app/dashboard/')({
  validateSearch: overviewSearchSchema,
  loaderDeps: ({ search }) => ({
    preset: search.preset,
    from: search.from,
    to: search.to,
    page: search.page ?? 1,
  }),
  loader: ({ context, deps }) => {
    const range = { preset: deps.preset, from: deps.from, to: deps.to }
    // Warm both caches; failures surface per-surface via component queries
    // (partial-failure strategy — plan §4.5), never as a blank page.
    return Promise.allSettled([
      context.queryClient.ensureQueryData(overviewQueryOptions(range)),
      context.queryClient.ensureQueryData(coursePerformanceQueryOptions(range, deps.page)),
    ])
  },
  component: AnalyticsOverviewPage,
})

/**
 * S-1.1 Analytics Overview: KPI stats row, revenue trend (line),
 * enrollments (bar), course performance table.
 */
function AnalyticsOverviewPage() {
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()
  const rangeInput = { preset: search.preset, from: search.from, to: search.to }
  const page = search.page ?? 1

  function applyRangeChange(next: DateRangeSelection) {
    navigate({
      search: (prev) => ({ ...prev, page: undefined, ...next }),
    })
  }

  const overviewQuery = useQuery(overviewQueryOptions(rangeInput))
  const performanceQuery = useQuery(coursePerformanceQueryOptions(rangeInput, page))

  function setPage(nextPage: number) {
    navigate({ search: (prev) => ({ ...prev, page: nextPage === 1 ? undefined : nextPage }) })
  }

  function handleExport() {
    const overview = overviewQuery.data
    if (!overview) return
    const csv = buildCsv(overview.kpis, [
      { header: 'Metric', value: (kpi) => kpi.label },
      { header: 'Value', value: (kpi) => kpi.value ?? '' },
      { header: 'Delta %', value: (kpi) => kpi.deltaPct ?? '' },
      { header: 'Availability', value: (kpi) => kpi.availability },
    ])
    downloadCsv(`abugida-overview-${new Date().toISOString().slice(0, 10)}.csv`, csv)
    toast.success('Dashboard exported as CSV.')
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header row: date range + export (spec S-1.1) */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <DateRangePicker
          selection={rangeInput}
          onChange={applyRangeChange}
          label={overviewQuery.data?.range.label ?? 'Date range'}
        />
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!overviewQuery.data}>
          Export
        </Button>
      </div>

      {/* Stats row — horizontal scroll on mobile (spec S-1.1) */}
      <section aria-label="Key metrics">
        <div className="flex snap-x gap-4 overflow-x-auto pb-1 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-4">
          {overviewQuery.isLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <StatCardSkeleton key={index} className="min-w-56 snap-start" />
              ))
            : overviewQuery.data?.kpis.map((metric) => (
                <StatCard key={metric.id} metric={metric} className="min-w-56 snap-start" />
              ))}
        </div>
      </section>

      {/* Chart row — stacked on tablet, 2 columns on desktop (spec 11) */}
      <section aria-label="Trends" className="grid gap-4 lg:grid-cols-2">
        <TrendCard
          title="Revenue Trend"
          description={overviewQuery.data?.revenueTrend.note}
          isLoading={overviewQuery.isLoading}
          isError={overviewQuery.isError}
          onRetry={() => overviewQuery.refetch()}
          availability={overviewQuery.data?.revenueTrend.availability}
          points={overviewQuery.data?.revenueTrend.points ?? []}
          granularity={overviewQuery.data?.revenueTrend.granularity ?? 'day'}
          kind="line"
          ariaLabel="Revenue trend for the selected period"
        />
        <TrendCard
          title="Enrollments"
          description={overviewQuery.data?.enrollmentTrend.note}
          isLoading={overviewQuery.isLoading}
          isError={overviewQuery.isError}
          onRetry={() => overviewQuery.refetch()}
          availability={overviewQuery.data?.enrollmentTrend.availability}
          points={overviewQuery.data?.enrollmentTrend.points ?? []}
          granularity={overviewQuery.data?.enrollmentTrend.granularity ?? 'day'}
          kind="bar"
          ariaLabel="Enrollments trend for the selected period"
          colorVar="var(--chart-2)"
        />
      </section>

      {/* Course performance table */}
      <Card className="gap-4 py-6">
        <CardHeader className="px-6">
          <CardTitle className="text-lg font-semibold">Course Performance</CardTitle>
        </CardHeader>
        <CardContent className="px-6">
          {performanceQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : performanceQuery.isError ? (
            <RetryErrorState
              title="Unable to load course performance. Retry?"
              onRetry={() => performanceQuery.refetch()}
            />
          ) : performanceQuery.data ? (
            <CoursePerformanceTable
              data={performanceQuery.data}
              onPageChange={setPage}
              isFetching={performanceQuery.isFetching}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

interface TrendCardProps {
  title: string
  description?: string
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  availability?: 'ok' | 'no_data' | 'unsupported'
  points: { date: string; value: number }[]
  granularity: 'day' | 'week' | 'month'
  kind: 'line' | 'bar'
  ariaLabel: string
  colorVar?: string
}

function TrendCard({
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
}: TrendCardProps) {
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </CardHeader>
      <CardContent className="px-5">
        {isLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : isError ? (
          <RetryErrorState title="Unable to load analytics. Retry?" onRetry={onRetry} />
        ) : availability === 'unsupported' ? (
          <EmptyState
            variant="compact"
            title="Not available for your role."
            description={description}
          />
        ) : points.length === 0 ? (
          <EmptyState
            variant="compact"
            title="No data available for the selected period."
            description="Try widening or changing the date range."
          />
        ) : (
          <TrendChart
            points={points}
            granularity={granularity}
            kind={kind}
            ariaLabel={ariaLabel}
            colorVar={colorVar}
          />
        )}
      </CardContent>
    </Card>
  )
}
