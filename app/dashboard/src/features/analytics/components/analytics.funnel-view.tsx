import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { EmptyState } from '#/components/common/empty-state'
import { Badge } from '#/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { selectLikelyCause } from '../analytics.metric-math'
import type { DropOffAnalytics, LessonEngagementRow } from '../analytics.types'

interface AnalyticsFunnelViewProps {
  data: DropOffAnalytics
}

/**
 * S-5.3 Drop-off Analysis: enrollment funnel (bars scaled to enrollment
 * count), ⚠ flags on >20-point declines, biggest-drop callout with lesson
 * engagement for the dropped-into module.
 */
export function AnalyticsFunnelView({ data }: AnalyticsFunnelViewProps) {
  if (data.isEmpty) {
    return (
      <EmptyState
        title="Not enough data yet — check back once more students enroll."
        description="The funnel fills in as enrollments and lesson completions are recorded."
      />
    )
  }

  const max = Math.max(...data.steps.map((step) => step.count), 1)
  const calloutLessons = data.likelyCauseLessons
  const likely = selectLikelyCause(calloutLessons)

  return (
    <div className="flex flex-col gap-4">
      <Card className="py-5">
        <CardHeader className="px-6">
          <CardTitle className="text-base font-semibold">Enrollment Funnel</CardTitle>
        </CardHeader>
        <CardContent
          className="flex flex-col gap-3 px-6"
          role="img"
          aria-label="Enrollment funnel by module"
        >
          {data.steps.map((step) => (
            <div key={step.label} className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm" title={step.label}>
                  {step.label}
                </span>
                <div
                  className={`h-6 rounded-sm ${step.flagged ? 'bg-destructive/70' : 'bg-primary/80'}`}
                  style={{ width: `${Math.max((step.count / max) * 55, 2)}%` }}
                  aria-hidden="true"
                />
                <span className="flex items-center gap-2 text-sm tabular-nums">
                  {step.count}
                  <span className="text-muted-foreground">({step.pctOfEnrolled}%)</span>
                  {step.flagged ? (
                    <Badge
                      variant="destructive"
                      aria-label={`Steep drop of ${step.declinePts} percentage points`}
                    >
                      ⚠ {step.declinePts} pts
                    </Badge>
                  ) : null}
                </span>
              </div>
            </div>
          ))}
          {/* Accessible alternative per spec 11 */}
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">View as table</summary>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Step</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead className="text-right">% of Enrolled</TableHead>
                  <TableHead className="text-right">Decline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.steps.map((step) => (
                  <TableRow key={step.label}>
                    <TableCell>{step.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{step.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{step.pctOfEnrolled}%</TableCell>
                    <TableCell className="text-right tabular-nums">{step.declinePts} pts</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </details>
        </CardContent>
      </Card>

      {data.biggestDrop && data.biggestDrop.declinePts > 0 ? (
        <Card className="border-destructive/30 py-5">
          <CardHeader className="px-6">
            <CardTitle className="text-base font-semibold">
              Biggest Drop: {data.biggestDrop.fromLabel} → {data.biggestDrop.toLabel} (
              {data.biggestDrop.declinePts} pts)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6">
            {likely ? (
              <p className="text-sm text-muted-foreground">
                Likely cause: <span className="font-medium text-foreground">{likely.title}</span>
                {likely.avgWatchPct != null
                  ? ` (avg watch time ${likely.avgWatchPct}% of runtime)`
                  : null}
                .
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Lesson-level engagement is not recorded for this module yet.
              </p>
            )}
            {calloutLessons.length > 0 ? (
              <div className="mt-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lesson</TableHead>
                      <TableHead className="text-right">Avg Watch %</TableHead>
                      <TableHead className="text-right">Completions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calloutLessons.map((lesson) => (
                      <LessonRow key={lesson.lessonId} lesson={lesson} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">{data.heatmapNote}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function LessonRow({ lesson }: { lesson: LessonEngagementRow }) {
  return (
    <TableRow>
      <TableCell>{lesson.title}</TableCell>
      <TableCell className="text-right tabular-nums">
        {lesson.avgWatchPct == null ? '—' : `${lesson.avgWatchPct}%`}
      </TableCell>
      <TableCell className="text-right tabular-nums">{lesson.completions}</TableCell>
    </TableRow>
  )
}
