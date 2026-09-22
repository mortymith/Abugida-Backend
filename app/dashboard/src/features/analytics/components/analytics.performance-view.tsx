import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { StatCard, StatCardSkeleton } from '#/features/dashboard/components/dashboard.stat-card'
import { performanceAnalyticsQueryOptions } from '../hooks/analytics.queries'
import { AnalyticsChartCard } from './analytics.chart-card'
import { AnalyticsWeekdayChart } from './analytics.weekday-chart'
import { ModuleBreakdownTable } from './analytics.module-breakdown'
import { AnalyticsSectionHeader } from './analytics.section-header'
import { AnalyticsExportModal } from './analytics.export-modal'
import type { DateRangeSelection } from '#/features/dashboard/components/dashboard.date-range-picker'
import { useState } from 'react'

interface AnalyticsPerformanceViewProps {
  courseId: string
  range: DateRangeSelection
  onRangeChange: (next: DateRangeSelection) => void
}

/**
 * S-5.1 Course Performance: KPI summary cards with period deltas, completion
 * rate trend (line), student activity by weekday (bar), and the module
 * breakdown table with quiz drill-downs. Sections fail independently.
 */
export function AnalyticsPerformanceView({
  courseId,
  range,
  onRangeChange,
}: AnalyticsPerformanceViewProps) {
  const [exportOpen, setExportOpen] = useState(false)
  const [pdfOpen, setPdfOpen] = useState(false)
  const query = useQuery(performanceAnalyticsQueryOptions(courseId, range))
  const data = query.data

  return (
    <div className="flex flex-col gap-6">
      <AnalyticsSectionHeader
        backTo="/analytics"
        backLabel="Back to analytics"
        title={data ? `${data.course.title} - Analytics` : 'Course Analytics'}
        subtitle={data?.range.label}
        selection={range}
        onRangeChange={onRangeChange}
        rangeLabel={data?.range.label}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              render={<Link to="/analytics/courses/$courseId/drop-off" params={{ courseId }} />}
            >
              Drop-off
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOpen(true)}
              disabled={!data || query.isError}
            >
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPdfOpen(true)}
              disabled={!data || query.isError}
            >
              PDF Report
            </Button>
          </>
        }
      />

      {query.isError ? (
        <RetryErrorState title="Unable to load analytics. Retry?" onRetry={() => query.refetch()} />
      ) : data?.isEmpty ? (
        <EmptyState
          title="No student data available for this course."
          description="KPIs, charts, and the module breakdown appear once students enroll."
        />
      ) : (
        <>
          {/* Performance summary cards (S-5.1) */}
          <section aria-label="Performance summary">
            <div className="flex snap-x gap-4 overflow-x-auto pb-1 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-4">
              {query.isLoading || !data
                ? Array.from({ length: 4 }).map((_, index) => (
                    <StatCardSkeleton key={index} className="min-w-56 snap-start" />
                  ))
                : data.kpis.map((metric) => (
                    <StatCard key={metric.id} metric={metric} className="min-w-56 snap-start" />
                  ))}
            </div>
          </section>

          {/* Charts row (2 columns on desktop) */}
          <section aria-label="Charts" className="grid gap-4 lg:grid-cols-2">
            <AnalyticsChartCard
              title="Completion Rate"
              description={data?.completionTrend.note}
              isLoading={query.isLoading}
              isError={query.isError}
              onRetry={() => query.refetch()}
              availability={data?.completionTrend.availability}
              points={data?.completionTrend.points ?? []}
              granularity={data?.completionTrend.granularity ?? 'day'}
              kind="line"
              ariaLabel="Completion rate over time"
              table={
                data ? (
                  <summary>
                    View as table
                    <table className="mt-1">
                      <tbody>
                        {data.completionTrend.points.map((point) => (
                          <tr key={point.date}>
                            <td className="pr-3">{point.date.slice(0, 10)}</td>
                            <td className="tabular-nums">{point.value}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </summary>
                ) : null
              }
            />
            <AnalyticsChartCard
              title="Student Activity"
              description={data?.weekdayActivity.note}
              isLoading={query.isLoading}
              isError={query.isError}
              onRetry={() => query.refetch()}
              availability={data?.weekdayActivity.availability}
              points={[]}
              granularity="day"
              kind="bar"
              ariaLabel="Student activity by day of week"
              emptyTitle="No activity recorded in this period."
            >
              {data ? (
                <AnalyticsWeekdayChart
                  days={data.weekdayActivity.days}
                  ariaLabel="Student activity by day of week"
                />
              ) : null}
            </AnalyticsChartCard>
          </section>

          {/* Module breakdown */}
          <Card className="gap-4 py-6">
            <CardHeader className="px-6">
              <CardTitle className="text-lg font-semibold">Module Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="px-6">
              {query.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                  ))}
                </div>
              ) : data ? (
                <ModuleBreakdownTable modules={data.modules} courseId={courseId} />
              ) : null}
            </CardContent>
          </Card>
        </>
      )}

      <AnalyticsExportModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        defaults={{
          reportType: 'course-performance',
          range,
          courseIds: [courseId],
        }}
      />
      <AnalyticsExportModal
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        defaults={{
          reportType: 'course-performance',
          range,
          courseIds: [courseId],
          defaultFormat: 'pdf',
        }}
      />
    </div>
  )
}
