import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { EmptyState } from '#/components/common/empty-state'
import { quizAnalyticsQueryOptions } from '../hooks/analytics.queries'
import { QuizQuestionTable } from './analytics.quiz-table'
import { AnalyticsSectionHeader } from './analytics.section-header'
import { AnalyticsExportModal } from './analytics.export-modal'
import type { DateRangeSelection } from '#/features/dashboard/components/dashboard.date-range-picker'

interface AnalyticsQuizViewProps {
  courseId: string
  lessonId: string
  range: DateRangeSelection
  onRangeChange: (next: DateRangeSelection) => void
}

/**
 * S-5.2 Quiz Analytics screen: attempt summary, worst-first per-question
 * table with distribution drill-down, Revise → lesson editor (S-2.8 quiz
 * builder entry), Export (S-5.4 modal pinned to this quiz).
 */
export function AnalyticsQuizView({
  courseId,
  lessonId,
  range,
  onRangeChange,
}: AnalyticsQuizViewProps) {
  const [exportOpen, setExportOpen] = useState(false)
  const query = useQuery(quizAnalyticsQueryOptions(courseId, lessonId, range))
  const data = query.data

  const summary = data ? (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{data.summary.attempts}</span> attempts ·{' '}
      <span className="font-medium text-foreground">
        {data.summary.avgScorePct == null ? '—' : `${data.summary.avgScorePct}%`}
      </span>{' '}
      avg score ·{' '}
      <span className="font-medium text-foreground">
        {data.summary.passRatePct == null ? '—' : `${data.summary.passRatePct}%`}
      </span>{' '}
      pass rate
    </p>
  ) : null

  return (
    <div className="flex flex-col gap-6">
      <AnalyticsSectionHeader
        backTo="/analytics/courses/$courseId"
        backParams={{ courseId }}
        backLabel="Back to course performance"
        title={data ? `Quiz Analytics — ${data.quiz.title}` : 'Quiz Analytics'}
        subtitle={data ? `${data.quiz.courseTitle} · ${data.range.label}` : undefined}
        selection={range}
        onRangeChange={onRangeChange}
        rangeLabel={data?.range.label}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              render={
                <Link to="/courses/$courseId/lessons/$lessonId" params={{ courseId, lessonId }} />
              }
            >
              Revise
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOpen(true)}
              disabled={!data}
            >
              Export
            </Button>
          </>
        }
      />

      {query.isError ? (
        <RetryErrorState title="Unable to load analytics. Retry?" onRetry={() => query.refetch()} />
      ) : data?.isEmpty ? (
        <EmptyState
          title="No attempts recorded yet for this quiz."
          description="Question-level statistics appear once students take the quiz."
        />
      ) : (
        <Card className="gap-4 py-6">
          <CardHeader className="px-6">
            <CardTitle className="text-base font-semibold">Per-Question Breakdown</CardTitle>
            {summary}
          </CardHeader>
          <CardContent className="px-6">
            {data ? (
              <QuizQuestionTable questions={data.questions} />
            ) : (
              <div className="h-40 animate-pulse rounded-md bg-muted/50" aria-hidden="true" />
            )}
          </CardContent>
        </Card>
      )}

      <AnalyticsExportModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        defaults={{
          reportType: 'quiz',
          range,
          courseIds: [courseId],
          lessonId,
        }}
      />
    </div>
  )
}
