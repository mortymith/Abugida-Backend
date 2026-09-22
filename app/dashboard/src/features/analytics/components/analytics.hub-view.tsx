import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { CoursePerformanceTable } from '#/features/dashboard/components/dashboard.course-performance-table'
import { coursePerformanceQueryOptions } from '#/features/dashboard/dashboard.queries'
import type { DateRangeSelection } from '#/features/dashboard/components/dashboard.date-range-picker'
import { AnalyticsSectionHeader } from './analytics.section-header'
import type { CoursePerformancePage } from '#/features/dashboard/dashboard.types'

interface AnalyticsHubViewProps {
  range: DateRangeSelection
  page: number
  onRangeChange: (next: DateRangeSelection) => void
  onPageChange: (page: number) => void
}

/**
 * Analytics hub (sidebar "Analytics" target): the course performance list as
 * the entry point — rows drill into S-5.1 Course Performance, an action opens
 * S-5.3 Drop-off, and Cohort Comparison (S-5.5) is one click away.
 */
export function AnalyticsHubView({
  range,
  page,
  onRangeChange,
  onPageChange,
}: AnalyticsHubViewProps) {
  const navigate = useNavigate()
  const query = useQuery(coursePerformanceQueryOptions(range, page))

  function openCourse(row: CoursePerformancePage['rows'][number]) {
    navigate({ to: '/analytics/courses/$courseId', params: { courseId: row.courseId } })
  }

  return (
    <div className="flex flex-col gap-6">
      <AnalyticsSectionHeader
        title="Analytics"
        subtitle="Course performance, drop-off, and cohort comparisons."
        selection={range}
        onRangeChange={onRangeChange}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: '/analytics/cohorts' })}
          >
            Compare Cohorts
          </Button>
        }
      />

      <Card className="gap-4 py-6">
        <CardHeader className="px-6">
          <CardTitle className="text-lg font-semibold">Course Performance</CardTitle>
        </CardHeader>
        <CardContent className="px-6">
          {query.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <RetryErrorState
              title="Unable to load analytics. Retry?"
              onRetry={() => query.refetch()}
            />
          ) : query.data ? (
            <CoursePerformanceTable
              data={query.data}
              onPageChange={onPageChange}
              isFetching={query.isFetching}
              onRowClick={openCourse}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
