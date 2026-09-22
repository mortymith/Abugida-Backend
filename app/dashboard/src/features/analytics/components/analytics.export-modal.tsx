import { useState } from 'react'
import { toast } from '#/components/common/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import { Skeleton } from '#/components/ui/skeleton'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { useRole } from '#/features/auth'
import { hasAtLeastRole } from '#/features/auth/auth.roles'
import { generateAnalyticsReport } from '../server/analytics.export'
import { exportCoursesQueryOptions } from '../hooks/analytics.queries'
import { useQuery } from '@tanstack/react-query'
import type { ReportFormat, ReportType } from '../analytics.types'
import type { DateRangeSelection } from '#/features/dashboard/components/dashboard.date-range-picker'

const REPORT_TYPE_LABELS: Array<{ value: ReportType; label: string }> = [
  { value: 'course-performance', label: 'Course Performance' },
  { value: 'student-progress', label: 'Student Progress' },
  { value: 'quiz', label: 'Quiz Analytics' },
  { value: 'revenue', label: 'Revenue Report' },
  { value: 'cohort-comparison', label: 'Cohort Comparison' },
]

const FORMAT_LABELS: Array<{ value: ReportFormat; label: string }> = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel' },
  { value: 'pdf', label: 'PDF' },
]

interface AnalyticsExportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Preset values from the calling screen (S-5.1 pins the course, etc.). */
  defaults: {
    reportType: ReportType
    range: DateRangeSelection
    courseIds?: string[]
    lessonId?: string
    cohortIds?: string[]
    defaultFormat?: ReportFormat
  }
}

/**
 * S-5.4 Export Reports modal. Generation runs server-side (role-enforced:
 * Admin/Editor; revenue additionally REVENUE_ROLES) and the client turns the
 * returned base64 payload into a file download.
 */
export function AnalyticsExportModal({ open, onOpenChange, defaults }: AnalyticsExportModalProps) {
  const role = useRole()
  const canExport = hasAtLeastRole(role, 'editor')

  const [reportType, setReportType] = useState<ReportType>(defaults.reportType)
  const [format, setFormat] = useState<ReportFormat>(defaults.defaultFormat ?? 'csv')
  const [courseIds, setCourseIds] = useState<string[]>(defaults.courseIds ?? [])
  const [includeAggregatedCharts, setIncludeAggregatedCharts] = useState(false)
  const [includeStudentLevelData, setIncludeStudentLevelData] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [preset, setPreset] = useState<DateRangeSelection>(defaults.range)

  const coursesQuery = useQuery({
    ...exportCoursesQueryOptions(),
    enabled: open && canExport,
  })

  function toggleCourse(courseId: string) {
    setCourseIds((previous) =>
      previous.includes(courseId)
        ? previous.filter((id) => id !== courseId)
        : [...previous, courseId],
    )
  }

  async function handleGenerate() {
    setIsGenerating(true)
    try {
      const report = await generateAnalyticsReport({
        data: {
          reportType,
          format,
          courseIds,
          includeAggregatedCharts,
          includeStudentLevelData,
          lessonId: defaults.lessonId,
          cohortIds: defaults.cohortIds,
          preset: preset.preset,
          from: preset.from,
          to: preset.to,
        },
      })
      downloadReport(report)
      toast.success('Report generated successfully.')
      onOpenChange(false)
    } catch {
      toast.error('Unable to generate report. Retry?')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export Reports</DialogTitle>
          <DialogDescription>
            Configure the report, then generate a downloadable file.
          </DialogDescription>
        </DialogHeader>

        {!canExport ? (
          <p className="text-sm text-muted-foreground">
            Export is available to Admin and Editor roles.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Report Type</legend>
              {REPORT_TYPE_LABELS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="report-type"
                    value={option.value}
                    checked={reportType === option.value}
                    onChange={() => setReportType(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>

            {reportType !== 'cohort-comparison' ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">Date Range</legend>
                <div className="flex flex-wrap gap-2 text-sm">
                  {(['7d', '30d', '90d', '12mo'] as const).map((option) => (
                    <label key={option} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="export-range"
                        checked={preset.preset === option && !preset.from}
                        onChange={() => setPreset({ preset: option })}
                      />
                      {option === '7d'
                        ? 'Last 7 days'
                        : option === '30d'
                          ? 'Last 30 days'
                          : option === '90d'
                            ? 'Last 90 days'
                            : 'Last 12 months'}
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Label htmlFor="export-from" className="text-xs text-muted-foreground">
                    Custom
                  </Label>
                  <input
                    id="export-from"
                    type="date"
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                    value={preset.from ?? ''}
                    onChange={(event) =>
                      setPreset((previous) => ({ ...previous, from: event.target.value }))
                    }
                  />
                  <span className="text-muted-foreground">to</span>
                  <input
                    id="export-to"
                    type="date"
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                    value={preset.to ?? ''}
                    onChange={(event) =>
                      setPreset((previous) => ({ ...previous, to: event.target.value }))
                    }
                  />
                </div>
              </fieldset>
            ) : null}

            {reportType !== 'cohort-comparison' ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">
                  Select Courses (none = all published)
                </legend>
                {coursesQuery.isLoading ? (
                  <div className="space-y-1">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Skeleton key={index} className="h-5 w-48" />
                    ))}
                  </div>
                ) : coursesQuery.isError ? (
                  <RetryErrorState
                    title="Unable to load courses. Retry?"
                    onRetry={() => coursesQuery.refetch()}
                  />
                ) : (
                  <div className="max-h-36 overflow-y-auto rounded-md border p-2">
                    {(coursesQuery.data ?? []).map((course) => (
                      <label
                        key={course.courseId}
                        className="flex items-center gap-2 py-0.5 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={courseIds.includes(course.courseId)}
                          onChange={() => toggleCourse(course.courseId)}
                        />
                        {course.title}
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            ) : null}

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Format</legend>
              <div className="flex gap-4 text-sm">
                {FORMAT_LABELS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="export-format"
                      checked={format === option.value}
                      onChange={() => setFormat(option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeAggregatedCharts}
                  onChange={(event) => setIncludeAggregatedCharts(event.target.checked)}
                />
                Include aggregated charts
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeStudentLevelData}
                  onChange={(event) => setIncludeStudentLevelData(event.target.checked)}
                />
                Include student-level data
              </label>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={!canExport || isGenerating}>
            {isGenerating ? 'Generating…' : 'Generate Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Turn the base64 payload into a browser download (client-side only). */
function downloadReport(report: { filename: string; mimeType: string; dataBase64: string }) {
  if (typeof document === 'undefined') return
  const binary = atob(report.dataBase64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  const blob = new Blob([bytes], { type: report.mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = report.filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
