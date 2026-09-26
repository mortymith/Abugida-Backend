import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { DownloadIcon, FlameIcon, TrophyIcon, TimerIcon } from 'lucide-react'
import { buildCsv, downloadCsv } from '#/features/dashboard/dashboard.export-csv'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { Badge } from '#/components/ui/badge'
import { Button, buttonVariants } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { formatPercent } from '#/lib/format'
import { studentProfileQueryOptions, studentProgressQueryOptions } from '../hooks/students.queries'
import type { StudentProgressDTO } from '../students.types'

/**
 * S-4.3 Student Progress Dashboard: overall completion, streak, time
 * invested, per-course breakdown with trend sparklines, certificates and
 * badges, at-risk flag, and CSV export of the report.
 */
export function StudentsProgressView({ studentId }: { studentId: string }) {
  const progressQuery = useQuery(studentProgressQueryOptions({ studentId }))
  const profileQuery = useQuery(studentProfileQueryOptions({ studentId }))
  const progress = progressQuery.data
  const profile = profileQuery.data

  const exportReport = () => {
    if (!progress) return
    const csv = buildCsv(progress.courses, [
      { header: 'Course', value: (row) => row.courseTitle },
      { header: 'Progress %', value: (row) => String(row.progressPercentage) },
      { header: 'Completed', value: (row) => (row.isCompleted ? 'yes' : 'no') },
      {
        header: 'Last Quiz %',
        value: (row) => (row.lastQuizScorePercent == null ? '' : String(row.lastQuizScorePercent)),
      },
      { header: 'Time Invested (hrs)', value: (row) => String(row.timeInvestedHours) },
    ])
    downloadCsv(
      `progress-${(profile?.name ?? 'student').toLowerCase().replaceAll(/\s+/g, '-')}.csv`,
      csv,
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/students/$studentId"
            params={{ studentId }}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            ← {profile?.name ?? 'Student Profile'}
          </Link>
          <h1 className="text-2xl font-bold">Progress — {profile?.name ?? '…'}</h1>
        </div>
        {progress && progress.courses.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportReport}>
            <DownloadIcon aria-hidden /> Export Report
          </Button>
        )}
      </div>

      {progressQuery.isPending ? (
        <div className="grid gap-4" role="status" aria-label="Loading progress">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : progressQuery.isError || !progress ? (
        <RetryErrorState
          title="Unable to load progress"
          description="Retry?"
          onRetry={() => void progressQuery.refetch()}
          isRetrying={progressQuery.isFetching}
        />
      ) : progress.courses.length === 0 ? (
        <EmptyState
          variant="standard"
          title="Not enrolled in any courses yet"
          description="Progress will appear here once the student enrolls and starts learning."
        />
      ) : (
        <ProgressBody progress={progress} />
      )}
    </div>
  )
}

function ProgressBody({ progress }: { progress: StudentProgressDTO }) {
  return (
    <div className="grid gap-5">
      {/* Summary bar */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Overall Completion</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-3xl font-bold tabular-nums">
              {progress.overallCompletion == null ? '—' : formatPercent(progress.overallCompletion)}
            </span>
            <div
              role="progressbar"
              aria-valuenow={progress.overallCompletion ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Overall completion"
              className="h-2.5 min-w-40 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, progress.overallCompletion ?? 0)}%` }}
              />
            </div>
            {progress.isAtRisk && (
              <Badge className="gap-1 bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                🟠 At risk — inactive 14+ days
              </Badge>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-5 text-sm">
            <span className="flex items-center gap-1.5">
              <FlameIcon aria-hidden className="size-4 text-orange-500" />
              <strong className="tabular-nums">{progress.currentStreakDays}</strong>
              <span className="text-muted-foreground">day streak</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <TimerIcon aria-hidden className="size-4" />
              {progress.timeInvestedHours.toFixed(1)} hrs invested · longest streak{' '}
              {progress.longestStreakDays} days
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Per-course breakdown */}
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Per-Course Breakdown
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {progress.courses.map((course) => (
            <Card key={course.coursePublicId}>
              <CardHeader className="pb-1">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold">{course.courseTitle}</CardTitle>
                  {course.isCompleted && (
                    <Badge className="shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      🏆 Done
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="grid gap-2">
                <TrendSparkline trend={course.trend} />
                <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {formatPercent(course.progressPercentage)} complete
                  </span>
                  <span>
                    {course.lastQuizScorePercent == null
                      ? 'No quizzes yet'
                      : `Last quiz: ${formatPercent(course.lastQuizScorePercent)}`}
                  </span>
                  <span>{course.timeInvestedHours.toFixed(1)} hrs</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Certificates + badges */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-semibold">Earned Certificates</CardTitle>
          </CardHeader>
          <CardContent>
            {progress.certificates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No certificates earned yet.</p>
            ) : (
              <ul className="grid gap-1.5">
                {progress.certificates.map((certificate) => (
                  <li key={certificate.serial} className="flex items-center gap-2 text-sm">
                    <TrophyIcon aria-hidden className="size-4 text-amber-500" />
                    <span className="font-medium">{certificate.courseTitle}</span>
                    <span className="text-xs text-muted-foreground">
                      {certificate.issuedAt.slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-semibold">Badges</CardTitle>
          </CardHeader>
          <CardContent>
            {progress.badges.length === 0 ? (
              <p className="text-sm text-muted-foreground">No badges earned yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {progress.badges.map((badge) => (
                  <li
                    key={badge.badgePublicId}
                    className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
                  >
                    <span aria-hidden>{badge.icon ?? '🏅'}</span>
                    {badge.name}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/** Compact SVG sparkline of cumulative completions over time. */
function TrendSparkline({ trend }: { trend: Array<{ date: string; completed: number }> }) {
  if (trend.length < 2) {
    return (
      <div className="flex h-12 items-center rounded-md bg-muted/40 px-3 text-xs text-muted-foreground">
        Not enough activity for a trend yet.
      </div>
    )
  }
  const width = 240
  const height = 48
  const maxCompleted = trend[trend.length - 1]?.completed ?? 1
  const points = trend.map((point, index) => {
    const x = (index / (trend.length - 1)) * width
    const y = height - (point.completed / maxCompleted) * (height - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-12 w-full rounded-md bg-muted/40"
      role="img"
      aria-label={`Progress trend: ${maxCompleted} lessons completed`}
      preserveAspectRatio="none"
    >
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-primary"
      />
    </svg>
  )
}
