import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '#/components/ui/button'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { dropOffAnalyticsQueryOptions } from '../hooks/analytics.queries'
import { AnalyticsFunnelView } from './analytics.funnel-view'
import { AnalyticsSectionHeader } from './analytics.section-header'
import { AnalyticsExportModal } from './analytics.export-modal'
import type { DateRangeSelection } from '#/features/dashboard/components/dashboard.date-range-picker'

interface AnalyticsDropOffViewProps {
  courseId: string
  range: DateRangeSelection
  onRangeChange: (next: DateRangeSelection) => void
}

/**
 * S-5.3 Drop-off Analysis screen: funnel + biggest-drop callout, header with
 * date range and Export (S-5.4 modal preset to this course).
 */
export function AnalyticsDropOffView({
  courseId,
  range,
  onRangeChange,
}: AnalyticsDropOffViewProps) {
  const [exportOpen, setExportOpen] = useState(false)
  const query = useQuery(dropOffAnalyticsQueryOptions(courseId, range))
  const data = query.data

  return (
    <div className="flex flex-col gap-6">
      <AnalyticsSectionHeader
        backTo="/analytics/courses/$courseId"
        backParams={{ courseId }}
        backLabel="Back to course performance"
        title={data ? `Drop-off Analysis — ${data.course.title}` : 'Drop-off Analysis'}
        subtitle={data?.range.label}
        selection={range}
        onRangeChange={onRangeChange}
        rangeLabel={data?.range.label}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportOpen(true)}
            disabled={!data || query.isError}
          >
            Export
          </Button>
        }
      />

      {query.isError ? (
        <RetryErrorState title="Unable to load analytics. Retry?" onRetry={() => query.refetch()} />
      ) : data ? (
        <AnalyticsFunnelView data={data} />
      ) : (
        <div className="h-64 animate-pulse rounded-md bg-muted/50" aria-hidden="true" />
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
    </div>
  )
}
