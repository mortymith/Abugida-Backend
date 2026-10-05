import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { Button } from '#/components/ui/button'
import { EmptyState } from '#/components/common/empty-state'
import { PageHeader } from '#/components/common/page-header'
import { RetryErrorState, readRequestId } from '#/components/common/retry-error-state'
import { StatCard, StatCardSkeleton } from '#/features/dashboard/components/dashboard.stat-card'
import { TrendChart } from '#/features/dashboard/components/dashboard.trend-chart'
import { ChartFigure } from '#/features/dashboard/components/dashboard.chart-figure'
import {
  CoursePerformanceTable,
  CoursePerformanceTableSkeleton,
} from '#/features/dashboard/components/dashboard.course-performance-table'
import { DateRangePicker } from '#/features/dashboard/components/dashboard.date-range-picker'
import type { DateRangeSelection } from '#/features/dashboard/components/dashboard.date-range-picker'
import { CompareToggle } from '#/features/dashboard/components/dashboard.compare-toggle'
import {
  DATE_RANGE_PRESETS,
  formatReportingTime,
  formatTrendBucket,
} from '#/features/dashboard/schemas/dashboard.date-range.schema'
import {
  overviewQueryOptions,
  coursePerformanceQueryOptions,
} from '#/features/dashboard/dashboard.queries'
import type { CoursePerformanceSort, TrendSeries } from '#/features/dashboard/dashboard.types'
import { AnalyticsExportModal } from '#/features/analytics'
import { hasAtLeastRole, REVENUE_ROLES, useRole } from '#/features/auth'
import { ChecklistCard, ChecklistResumeLink } from '#/features/onboarding'
import { trackNavEvent } from '#/features/navigation'
import { useOnline } from '#/hooks/use-online'
import { useHydrated } from '#/hooks/use-hydrated'

const overviewSearchSchema = z.object({
  preset: z.enum(DATE_RANGE_PRESETS).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  compare: z.union([z.literal('true'), z.literal('false')]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  sort: z.enum(['revenue', 'students', 'completion']).optional(),
})

export const Route = createFileRoute('/_app/dashboard/')({
  validateSearch: overviewSearchSchema,
  loaderDeps: ({ search }) => ({
    preset: search.preset,
    from: search.from,
    to: search.to,
    page: search.page ?? 1,
    sort: search.sort ?? 'revenue',
  }),
  loader: ({ context, deps }) => {
    const range = { preset: deps.preset, from: deps.from, to: deps.to }
    // Warm both caches; failures surface per-surface via component queries
    // (partial-failure strategy, spec 11), never as a blank page.
    return Promise.allSettled([
      context.queryClient.ensureQueryData(overviewQueryOptions(range)),
      context.queryClient.ensureQueryData(
        coursePerformanceQueryOptions(range, deps.page, deps.sort),
      ),
    ])
  },
  component: AnalyticsOverviewPage,
})

/**
 * S-1.1 Analytics Overview: KPI stats row, revenue trend (line), enrollments
 * (bar), course performance table.
 *
 * One date range governs the whole screen (URL state), every card names its
 * comparison basis, and every state the spec distinguishes has its own copy:
 * true-empty, empty-in-range, zero-result, revenue-restricted, and error.
 */
function AnalyticsOverviewPage() {
  const navigate = useNavigate({ from: Route.fullPath })
  const router = useRouter()
  const search = Route.useSearch()
  const page = search.page ?? 1
  const sort = search.sort ?? 'revenue'
  const compareEnabled = search.compare !== 'false'
  const online = useOnline()
  const hydrated = useHydrated()
  const rangeInput = { preset: search.preset, from: search.from, to: search.to }
  // S-1.1 navigation: Export opens the shared Export Reports flow (S-5.4),
  // which is role-gated server-side; the action is absent for roles without it.
  const role = useRole()
  const canExport = hasAtLeastRole(role, 'editor')
  const canViewRevenue = REVENUE_ROLES.includes(role)
  const [exportOpen, setExportOpen] = useState(false)

  const overviewQuery = useQuery(overviewQueryOptions(rangeInput))
  const performanceQuery = useQuery(coursePerformanceQueryOptions(rangeInput, page, sort))

  const overview = overviewQuery.data
  const comparisonLabel = overview?.range.comparisonLabel
  const isStale = !online && hydrated && overviewQuery.dataUpdatedAt > 0

  function applyRangeChange(next: DateRangeSelection) {
    trackNavEvent('dashboard_range_changed', {
      preset: next.preset ?? 'custom',
      compare: compareEnabled,
    })
    navigate({ search: (prev) => ({ ...prev, page: undefined, ...next }) })
  }

  function setPage(nextPage: number) {
    navigate({ search: (prev) => ({ ...prev, page: nextPage === 1 ? undefined : nextPage }) })
  }

  function setSort(nextSort: CoursePerformanceSort) {
    navigate({ search: (prev) => ({ ...prev, page: undefined, sort: nextSort }) })
  }

  function setCompare(next: boolean) {
    trackNavEvent('dashboard_range_changed', { preset: search.preset ?? 'default', compare: next })
    navigate({ search: (prev) => ({ ...prev, compare: next ? undefined : 'false' }) })
  }

  function clearFilters() {
    navigate({
      search: { preset: '30d', compare: search.compare === 'false' ? 'false' : undefined },
    })
  }

  const overviewFailed = overviewQuery.isError && !overviewQuery.isFetching
  const isZeroResult = performanceQuery.data != null && performanceQuery.data.rows.length === 0
  const revenueCard = overview?.kpis.find((kpi) => kpi.id === 'revenue')
  const revenueRestricted = revenueCard?.restricted === true
  const revenueRestrictionNote = revenueCard?.note

  // `dashboard_viewed{range,compare,courseCount}` — ids and counts only.
  useEffect(() => {
    if (!overview) return
    trackNavEvent('dashboard_viewed', {
      range: overview.range.label,
      compare: compareEnabled,
      courseCount: performanceQuery.data?.totalRows ?? 0,
    })
  }, [overview, compareEnabled, performanceQuery.data?.totalRows])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Revenue, enrollments, and course performance for the selected period."
        actions={
          <>
            <ChecklistResumeLink />
            <DateRangePicker
              selection={rangeInput}
              onChange={applyRangeChange}
              label={overview?.range.label ?? 'Date range'}
            />
            <CompareToggle enabled={compareEnabled} onToggle={setCompare} />
            {canExport ? (
              <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
                Export
              </Button>
            ) : null}
          </>
        }
      >
        {overview?.range.partialDayNote ? (
          <p className="text-xs text-muted-foreground">{overview.range.partialDayNote}</p>
        ) : null}
        {isStale ? (
          <p className="text-xs text-warning-fg">
            Offline — showing the last known values, last updated{' '}
            {formatReportingTime(new Date(overviewQuery.dataUpdatedAt))}.
          </p>
        ) : null}
      </PageHeader>

      {/* S-0.2 Getting Started Checklist. Renders nothing once every applicable
          item is complete, and the payment task is absent for a workspace that
          will never charge. */}
      <ChecklistCard id="getting-started" />

      {/* True empty — the workspace has no history at all. Distinct from "no data
          in this range", and the only state that offers a creation path. */}
      {overview && !overview.hasHistory && !overviewFailed ? (
        <Card>
          <CardContent className="pt-2">
            <EmptyState
              level={2}
              title="No history yet"
              description="Data appears once your first course is published."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void router.history.push('/courses/new')}
                >
                  Create your first course
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {overviewFailed ? (
        <RetryErrorState
          title="We couldn't load your dashboard — your work is safe."
          description="Nothing has been changed. Retrying usually fixes it."
          onRetry={() => void overviewQuery.refetch()}
          isRetrying={overviewQuery.isFetching}
          requestId={readRequestId(overviewQuery.error)}
        />
      ) : null}

      {/* Stats row — horizontal scroll on mobile (spec S-1.1) */}
      <section aria-label="Key metrics">
        <div className="flex snap-x gap-4 overflow-x-auto pb-1 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-4">
          {overviewQuery.isLoading || (!overview && !overviewFailed)
            ? Array.from({ length: 4 }).map((_, index) => (
                <StatCardSkeleton key={index} className="min-w-56 snap-start" />
              ))
            : overview?.kpis.map((metric) => (
                <StatCard
                  key={metric.id}
                  metric={metric}
                  comparisonLabel={comparisonLabel}
                  compareEnabled={compareEnabled}
                  onRetry={() => void overviewQuery.refetch()}
                  className="min-w-56 snap-start"
                />
              ))}
        </div>
      </section>

      {/* Chart row — stacked on tablet, 2 columns on desktop (spec 11) */}
      {overview?.isEmpty && overview.hasHistory ? (
        <EmptyState
          level={2}
          title="No data for the selected period — adjust the date range."
          description="Nothing was recorded in these dates."
          action={
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <section aria-label="Trends" className="grid gap-4 lg:grid-cols-2">
          <TrendCard
            title="Revenue Trend"
            description={overview?.range.label}
            isLoading={overviewQuery.isLoading}
            onRetry={() => void overviewQuery.refetch()}
            series={overview?.revenueTrend}
            // Only a redacted card carries the role explanation — a permitted
            // role with no revenue in range gets the ordinary empty state.
            restrictedLabel={revenueRestricted ? revenueRestrictionNote : undefined}
            kind="line"
            ariaLabel="Revenue trend for the selected period"
            valueHeader="Revenue"
          />
          <TrendCard
            title="Enrollments"
            description={overview?.range.label}
            isLoading={overviewQuery.isLoading}
            onRetry={() => void overviewQuery.refetch()}
            series={overview?.enrollmentTrend}
            kind="bar"
            ariaLabel="Enrollments trend for the selected period"
            colorVar="var(--chart-2)"
            valueHeader="Enrollments"
          />
        </section>
      )}

      {/* Course performance table */}
      <Card className="gap-4 py-6">
        <CardHeader className="px-6">
          <CardTitle className="text-lg font-semibold">Course Performance</CardTitle>
        </CardHeader>
        <CardContent className="px-6">
          {performanceQuery.isLoading || (!performanceQuery.data && !performanceQuery.isError) ? (
            <CoursePerformanceTableSkeleton columns={canViewRevenue ? 5 : 4} />
          ) : performanceQuery.isError ? (
            <RetryErrorState
              title="Unable to load course performance — nothing has changed."
              onRetry={() => void performanceQuery.refetch()}
              requestId={readRequestId(performanceQuery.error)}
            />
          ) : (
            <CoursePerformanceTable
              data={performanceQuery.data}
              onPageChange={setPage}
              onSortChange={setSort}
              isFetching={performanceQuery.isFetching}
              getRowHref={(row) => `/courses/${row.courseId}`}
              onRowOpen={(row) =>
                trackNavEvent('dashboard_course_opened', { courseId: row.courseId })
              }
              isFiltered={isZeroResult && performanceQuery.data.totalRows > 0}
              onClearFilters={clearFilters}
            />
          )}
        </CardContent>
      </Card>

      <AnalyticsExportModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        defaults={{ reportType: 'course-performance', range: rangeInput }}
      />
    </div>
  )
}

interface TrendCardProps {
  title: string
  description?: string
  isLoading: boolean
  onRetry: () => void
  series?: TrendSeries
  restrictedLabel?: string
  kind: 'line' | 'bar'
  ariaLabel: string
  valueHeader: string
  colorVar?: string
}

/**
 * One chart with its own loading, empty, restricted and failure states, plus the
 * keyboard-reachable **View as table** toggle the spec requires. The table is
 * built only when it is asked for.
 */
function TrendCard({
  title,
  description,
  isLoading,
  onRetry,
  series,
  restrictedLabel,
  kind,
  ariaLabel,
  valueHeader,
  colorVar,
}: TrendCardProps) {
  const availability = series?.availability
  const points = series?.points ?? []
  const restricted = availability === 'no_data' && restrictedLabel != null && points.length === 0

  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </CardHeader>
      <CardContent className="px-5">
        {isLoading ? (
          <Skeleton className="h-[280px] w-full" aria-hidden="true" />
        ) : availability === 'error' ? (
          <EmptyState
            variant="compact"
            level={3}
            title={series?.note ?? `${title} couldn't load.`}
            action={
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
            }
          />
        ) : availability === 'unsupported' ? (
          <EmptyState
            variant="compact"
            level={3}
            title="Not available yet."
            description={series?.note}
          />
        ) : points.length === 0 ? (
          <EmptyState
            variant="compact"
            level={3}
            title={
              restricted
                ? 'Revenue is limited to Admins and Editors. Ask an Admin if you need this figure.'
                : 'No data for the selected period — adjust the date range.'
            }
            description={restricted ? undefined : 'Try widening or changing the date range.'}
          />
        ) : (
          <ChartFigure
            label={ariaLabel}
            valueHeader={valueHeader}
            rows={points.map((point) => ({
              label: formatTrendBucket(point.date, series?.granularity ?? 'day'),
              value: point.value,
            }))}
            formatValue={(value) => value.toLocaleString('en-US')}
          >
            <div role="img" aria-label={ariaLabel}>
              <TrendChart
                points={points}
                granularity={series?.granularity ?? 'day'}
                kind={kind}
                ariaLabel={ariaLabel}
                colorVar={colorVar}
              />
            </div>
          </ChartFigure>
        )}
      </CardContent>
    </Card>
  )
}
