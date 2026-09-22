import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { toast } from '#/components/common/toast'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Spinner } from '#/components/ui/spinner'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { StatusPill } from './courses.status-pill'
import { CurriculumEditor } from './courses.course-wizard'
import { UnlockRulesSheet } from './courses.unlock-rules-sheet'
import { DuplicateLessonModal } from './courses.duplicate-lesson-modal'
import { BulkImportModal } from './courses.import-modal'
import {
  courseAnalyticsQueryOptions,
  courseDetailsQueryOptions,
  courseQueryKeys,
  completionSettingsQueryOptions,
  curriculumQueryOptions,
  liveSessionsQueryOptions,
} from '../hooks/courses.queries'
import { buildCsv } from '#/features/dashboard/dashboard.export-csv'
import type { CourseStudentRow } from '../courses.types'

// (Dialog re-exports come from the ui barrel above; no extra wiring needed.)

const TABS = ['curriculum', 'students', 'analytics', 'sessions', 'settings'] as const
type CourseTab = (typeof TABS)[number]

/**
 * S-2.6 Course Detail: header actions (status, preview, edit details,
 * duplicate, archive) + tabs Curriculum / Students / Analytics / Sessions /
 * Settings. Settings hosts S-2.10 completion rules + certificate template
 * and the S-2.14 per-course approval gating toggle.
 */
export function CourseDetail({
  courseId,
  role,
  webAppUrl,
}: {
  courseId: string
  role: string
  webAppUrl?: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const search = useSearch({ from: '/_app/courses/$courseId' })
  const tab: CourseTab = TABS.includes(search.tab as CourseTab)
    ? (search.tab as CourseTab)
    : 'curriculum'
  const isAuthoring = role === 'admin' || role === 'editor'

  const details = useQuery(courseDetailsQueryOptions(courseId))
  const curriculum = useQuery(curriculumQueryOptions(courseId))
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null)
  const [unlockLesson, setUnlockLesson] = useState<string | null>(null)
  const [duplicateLesson, setDuplicateLesson] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const duplicateLessonTitle =
    duplicateLesson != null
      ? (curriculum.data?.modules
          .flatMap((module) => module.lessons)
          .find((lesson) => lesson.publicId === duplicateLesson)?.title ?? 'Lesson')
      : ''

  const archive = useMutation({
    mutationFn: async () => {
      const { archiveCourse } = await import('../server/all')
      return archiveCourse({ data: { coursePublicId: courseId } })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: courseQueryKeys.details(courseId) })
      toast.success('Course archived successfully.')
      void navigate({ to: '/courses' })
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Failed'),
  })
  const removeCourse = useMutation({
    mutationFn: async () => {
      const { deleteCourse } = await import('../server/all')
      return deleteCourse({ data: { coursePublicId: courseId } })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['courses'] })
      toast.success('Course deleted.')
      void navigate({ to: '/courses' })
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Failed'),
  })
  const saveTemplate = useMutation({
    mutationFn: async (name: string) => {
      const { saveCourseAsTemplate } = await import('../server/all')
      return saveCourseAsTemplate({ data: { coursePublicId: courseId, name, category: 'general' } })
    },
    onSuccess: () => toast.success('Saved as a workspace template.'),
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Failed'),
  })

  if (details.isPending) return <Spinner className="mx-auto my-12" />
  if (details.isError) {
    return <RetryErrorState onRetry={() => void details.refetch()} />
  }
  const course = details.data

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <nav className="text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/courses" className="hover:underline">
            Courses
          </Link>{' '}
          / {course.title}
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold">{course.title}</h1>
            <StatusPill tone={course.status} />
            <StatusPill tone={course.courseType} />
            {course.requiresApproval ? (
              <StatusPill tone="review" label="Approval required" />
            ) : null}
          </div>
          {isAuthoring ? (
            <div className="flex flex-wrap items-center gap-2">
              {webAppUrl ? (
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <a
                      href={`${webAppUrl}/courses/${course.slug}`}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  Preview
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  title="Set WEB_APP_URL to preview the student view"
                >
                  Preview
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                render={<Link to="/courses/new" search={{ step: 1, from: courseId }} />}
              >
                Edit Details
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirm('archive')}>
                Archive
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="More course actions"
                onClick={() => {
                  const name = window.prompt('Save as template (name)', `${course.title} template`)
                  if (name && name.trim().length >= 3) saveTemplate.mutate(name.trim())
                }}
              >
                ⋯
              </Button>
            </div>
          ) : null}
        </div>
        {course.status === 'draft' ? (
          <p
            className="rounded-lg border bg-muted/30 p-2 text-sm text-muted-foreground"
            role="status"
          >
            This course is in <strong>Draft</strong> mode. Publish it from the wizard to make it
            visible.
          </p>
        ) : null}
        {course.status === 'published' ? (
          <p
            className="rounded-lg border border-green-300 bg-green-50 p-2 text-sm text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-200"
            role="status"
          >
            Published {course.publishedAt ? new Date(course.publishedAt).toLocaleString() : ''}.
          </p>
        ) : null}
      </header>

      <div role="tablist" aria-label="Course sections" className="flex flex-wrap gap-1 border-b">
        {TABS.map((candidate) => (
          <button
            key={candidate}
            role="tab"
            aria-selected={tab === candidate}
            className={
              'border-b-2 px-3 py-2 text-sm capitalize' +
              (tab === candidate
                ? ' border-violet-500 font-medium'
                : ' border-transparent text-muted-foreground hover:text-foreground')
            }
            onClick={() =>
              void navigate({
                to: '/courses/$courseId',
                params: { courseId },
                search: { tab: candidate },
              })
            }
          >
            {candidate === 'sessions' ? 'Sessions' : candidate}
          </button>
        ))}
      </div>

      {tab === 'curriculum' ? (
        <>
          {isAuthoring ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                Import from file
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled
                title="Selection mode for the Content Library arrives with spec 05"
              >
                Import from Library
              </Button>
            </div>
          ) : null}
          <CurriculumEditor
            coursePublicId={courseId}
            queryClient={queryClient}
            authoring={isAuthoring}
            onOpenUnlockRules={isAuthoring ? setUnlockLesson : undefined}
            onDuplicateLesson={isAuthoring ? setDuplicateLesson : undefined}
          />
        </>
      ) : null}

      {tab === 'students' ? <StudentsTab courseId={courseId} /> : null}
      {tab === 'analytics' ? <AnalyticsTab courseId={courseId} /> : null}
      {tab === 'sessions' ? <SessionsTab courseId={courseId} /> : null}
      {tab === 'settings' ? <SettingsTab courseId={courseId} role={role} /> : null}

      <UnlockRulesSheet
        lessonPublicId={unlockLesson}
        onOpenChange={(open) => !open && setUnlockLesson(null)}
      />
      <DuplicateLessonModal
        lessonPublicId={duplicateLesson}
        lessonTitle={duplicateLessonTitle}
        sourceCoursePublicId={courseId}
        onClose={() => setDuplicateLesson(null)}
      />
      <BulkImportModal open={importOpen} onOpenChange={setImportOpen} coursePublicId={courseId} />

      <ConfirmDialog
        open={confirm === 'archive'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Archive this course?"
        body="Archived courses are hidden from the default catalog. Existing enrollments keep their access."
        confirmLabel="Archive"
        onConfirm={() => {
          void archive.mutateAsync()
        }}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Delete this course?"
        body={`Are you sure you want to delete "${course.title}"? This action cannot be undone.`}
        confirmLabel="Delete course"
        destructive
        onConfirm={() => {
          void removeCourse.mutateAsync()
        }}
      />
    </div>
  )
}

function StudentsTab({ courseId }: { courseId: string }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const students = useQuery(courseStudentsQuery(courseId, search, page))

  const exportCsv = useMutation({
    mutationFn: async () => {
      const { getCourseStudents } = await import('../server/all')
      const result = await getCourseStudents({ data: { coursePublicId: courseId, page: 0 } })
      return buildCsv<CourseStudentRow>(result.items, [
        { header: 'Student', value: (row) => row.studentName },
        { header: 'Email', value: (row) => row.studentEmail },
        { header: 'Progress %', value: (row) => row.progressPercentage },
        { header: 'Completed', value: (row) => (row.isCompleted ? 'yes' : 'no') },
        { header: 'Completed at', value: (row) => row.completedAt },
        { header: 'Last active', value: (row) => row.lastAccessedAt },
      ])
    },
    onSuccess: (csv) => {
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'course-students.csv'
      anchor.click()
      URL.revokeObjectURL(url)
    },
    onError: () => toast.error('Export failed'),
  })

  if (students.isPending) return <Spinner className="mx-auto my-8" />
  if (students.isError) return <RetryErrorState onRetry={() => void students.refetch()} />

  return (
    <section className="flex flex-col gap-3" aria-label="Enrolled students">
      <div className="flex flex-wrap gap-2">
        <Input
          className="w-64"
          placeholder="Search students…"
          aria-label="Search students"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(0)
          }}
        />
        <Button variant="outline" size="sm" onClick={() => exportCsv.mutate()}>
          Export CSV
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled
          title="Cohorts arrive with the Students module (spec 06)"
        >
          + Add Cohort
        </Button>
      </div>

      {students.data.items.length === 0 ? (
        <EmptyState
          variant={search ? 'compact' : 'standard'}
          title={search ? 'No students match.' : 'No students enrolled yet.'}
          description={search ? 'Adjust the search.' : 'Enrollments appear as students join.'}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Student
                </th>
                <th scope="col" className="px-3 py-2">
                  Progress
                </th>
                <th scope="col" className="px-3 py-2">
                  Completion
                </th>
                <th scope="col" className="px-3 py-2">
                  Last Active
                </th>
              </tr>
            </thead>
            <tbody>
              {students.data.items.map((row) => (
                <tr key={row.enrollmentPublicId} className="border-t">
                  <td className="px-3 py-2">
                    <span className="font-medium">{row.studentName}</span>
                    <span className="block text-xs text-muted-foreground">{row.studentEmail}</span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.progressPercentage}%</td>
                  <td className="px-3 py-2">
                    {row.isCompleted
                      ? `✅ ${row.completedAt ? new Date(row.completedAt).toLocaleDateString() : ''}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.lastAccessedAt ? relativeDays(row.lastAccessedAt) : 'never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {students.data.totalCount > students.data.items.length ? (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((previous) => previous - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={(page + 1) * 25 >= students.data.totalCount}
            onClick={() => setPage((previous) => previous + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </section>
  )
}

function courseStudentsQuery(courseId: string, search: string, page: number) {
  return {
    queryKey: courseQueryKeys.students(courseId, search, page),
    queryFn: async () => {
      const { getCourseStudents } = await import('../server/all')
      return getCourseStudents({
        data: { coursePublicId: courseId, search: search || undefined, page },
      })
    },
  }
}

function relativeDays(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

function AnalyticsTab({ courseId }: { courseId: string }) {
  const analytics = useQuery(courseAnalyticsQueryOptions(courseId))

  if (analytics.isPending) return <Spinner className="mx-auto my-8" />
  if (analytics.isError) return <RetryErrorState onRetry={() => void analytics.refetch()} />

  const data = analytics.data
  return (
    <section className="flex flex-col gap-4" aria-label="Course analytics">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Students" value={String(data.studentCount)} />
        <StatCard label="Active (7d)" value={String(data.activeStudents7d)} />
        <StatCard
          label="Avg rating"
          value={data.averageRating == null ? '—' : `${data.averageRating.toFixed(1)} ★`}
          hint={data.ratingCount > 0 ? `${data.ratingCount} ratings` : undefined}
        />
        <StatCard
          label="Completion rate"
          value={data.completionRate == null ? '—' : `${data.completionRate}%`}
        />
      </div>

      <div className="rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th scope="col" className="px-3 py-2">
                Module
              </th>
              <th scope="col" className="px-3 py-2">
                Lessons
              </th>
              <th scope="col" className="px-3 py-2">
                Avg progress
              </th>
            </tr>
          </thead>
          <tbody>
            {data.moduleBreakdown.map((module) => (
              <tr key={module.moduleTitle} className="border-t">
                <td className="px-3 py-2 font-medium">{module.moduleTitle}</td>
                <td className="px-3 py-2 tabular-nums">{module.lessonCount}</td>
                <td className="px-3 py-2 tabular-nums">
                  {module.avgProgress == null ? '—' : `${module.avgProgress}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Deep-dive analytics (module drop-off, quiz analytics, watch-time heatmaps) arrive with the
        Analytics module (spec 07).
      </p>
    </section>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function SessionsTab({ courseId }: { courseId: string }) {
  const sessions = useQuery(liveSessionsQueryOptions(courseId))
  const details = useQuery(courseDetailsQueryOptions(courseId))
  const [scheduling, setScheduling] = useState(false)

  if (!courseId) return null
  if (sessions.isPending || details.isPending) return <Spinner className="mx-auto my-8" />
  if (sessions.isError) return <RetryErrorState onRetry={() => void sessions.refetch()} />

  const isLiveCourse = details.data?.courseType !== 'self_paced'
  const upcoming = sessions.data.upcoming
  const history = sessions.data.history

  return (
    <section className="flex flex-col gap-4" aria-label="Live sessions">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Live Sessions</h2>
          {!isLiveCourse ? (
            <p className="text-xs text-muted-foreground">
              Tip: Live sessions suit Instructor-Led or Hybrid courses (set in Details).
            </p>
          ) : null}
        </div>
        <Button size="sm" onClick={() => setScheduling(true)}>
          + Schedule
        </Button>
      </div>

      {upcoming.length === 0 ? (
        <EmptyState
          variant="compact"
          title="No upcoming sessions."
          description="Schedule the first live session."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Session
                </th>
                <th scope="col" className="px-3 py-2">
                  Date/Time
                </th>
                <th scope="col" className="px-3 py-2">
                  Provider
                </th>
                <th scope="col" className="px-3 py-2">
                  Attendees
                </th>
                <th scope="col" className="px-3 py-2">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((session) => (
                <SessionRow key={session.publicId} session={session} courseId={courseId} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {history.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            History ({history.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
            {history.map((session) => (
              <li key={session.publicId}>
                {session.title} — {new Date(session.scheduledAt).toLocaleString()} ·{' '}
                {session.status}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {scheduling ? (
        <ScheduleSessionModal courseId={courseId} onClose={() => setScheduling(false)} />
      ) : null}
    </section>
  )
}

function SessionRow({
  session,
  courseId,
}: {
  session: {
    publicId: string
    title: string
    scheduledAt: string
    provider: string
    attendeeCount: number
    joinUrl: string | null
  }
  courseId: string
}) {
  const queryClient = useQueryClient()
  const cancel = useMutation({
    mutationFn: async (notifyAttendees: boolean) => {
      const { cancelLiveSession } = await import('../server/all')
      return cancelLiveSession({ data: { sessionPublicId: session.publicId, notifyAttendees } })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: courseQueryKeys.liveSessions(courseId) })
      toast.success('Session cancelled.')
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Failed'),
  })
  const [confirmCancel, setConfirmCancel] = useState(false)

  return (
    <tr className="border-t">
      <td className="px-3 py-2 font-medium">{session.title}</td>
      <td className="px-3 py-2">{new Date(session.scheduledAt).toLocaleString()}</td>
      <td className="px-3 py-2 capitalize">{session.provider.replace('_', ' ')}</td>
      <td className="px-3 py-2 tabular-nums">{session.attendeeCount}</td>
      <td className="px-3 py-2">
        {session.joinUrl ? (
          <a
            href={session.joinUrl}
            target="_blank"
            rel="noreferrer"
            className="text-violet-600 hover:underline"
          >
            Join link
          </a>
        ) : (
          '—'
        )}{' '}
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Cancel ${session.title}`}
          onClick={() => setConfirmCancel(true)}
        >
          ✕
        </Button>
      </td>
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this session?"
        body={`Attendees were told about "${session.title}". Notify them of the cancellation?`}
        confirmLabel="Cancel session"
        destructive
        onConfirm={() => {
          void cancel.mutateAsync(true)
        }}
      />
    </tr>
  )
}

function ScheduleSessionModal({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const reference = useQuery({
    queryKey: courseQueryKeys.reference(),
    queryFn: async () => {
      const { getCourseFormReference } = await import('../server/all')
      return getCourseFormReference()
    },
  })

  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('60')
  const [hostId, setHostId] = useState('')
  const [provider, setProvider] = useState<'zoom' | 'google_meet' | 'custom'>('zoom')
  const [joinUrl, setJoinUrl] = useState('')
  const [autoRecord, setAutoRecord] = useState(true)
  const [reminder24h, setReminder24h] = useState(true)
  const [reminder1h, setReminder1h] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: async () => {
      const { saveLiveSession } = await import('../server/all')
      return saveLiveSession({
        data: {
          coursePublicId: courseId,
          title,
          scheduledAt: new Date(scheduledAt).toISOString(),
          durationMinutes: Number(durationMinutes) || null,
          hostId: hostId || reference.data?.instructors[0]?.id || '',
          provider,
          joinUrl: joinUrl || null,
          autoRecord,
          reminder24h,
          reminder1h,
        },
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: courseQueryKeys.liveSessions(courseId) })
      toast.success('Session scheduled. Reminder emails: 24h/1h before.')
      onClose()
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : 'Failed'),
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule a live session</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="session-title">Session title</Label>
            <Input
              id="session-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="session-when">Date &amp; time</Label>
              <Input
                id="session-when"
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="session-duration">Duration (minutes)</Label>
              <Input
                id="session-duration"
                type="number"
                min="15"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="session-host">Host</Label>
            <select
              id="session-host"
              className="h-9 w-full rounded-lg border bg-input/30 px-3 text-sm"
              value={hostId}
              onChange={(event) => setHostId(event.target.value)}
            >
              <option value="">Select host…</option>
              {(reference.data?.instructors ?? []).map((instructor) => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.name}
                </option>
              ))}
            </select>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Conferencing Provider</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {(['zoom', 'google_meet', 'custom'] as const).map((option) => (
                <label key={option} className="flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    name="provider"
                    checked={provider === option}
                    onChange={() => setProvider(option)}
                  />
                  {option === 'zoom'
                    ? 'Zoom'
                    : option === 'google_meet'
                      ? 'Google Meet'
                      : 'Custom URL'}
                </label>
              ))}
            </div>
            {provider === 'custom' ? (
              <Input
                className="mt-2"
                placeholder="https://meet.example.com/room"
                aria-label="Custom join URL"
                value={joinUrl}
                onChange={(event) => setJoinUrl(event.target.value)}
              />
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Zoom/Meet link generation is an external integration follow-up — paste the join URL
                into the lesson or share it with attendees after saving.
              </p>
            )}
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRecord}
              onChange={(event) => setAutoRecord(event.target.checked)}
            />
            Auto-record and attach to lesson after session
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={reminder24h}
                onChange={(event) => setReminder24h(event.target.checked)}
              />
              Reminder 24h before
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={reminder1h}
                onChange={(event) => setReminder1h(event.target.checked)}
              />
              Reminder 1h before
            </label>
          </div>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!title.trim() || !scheduledAt || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? <Spinner className="size-4" /> : null}
              Schedule
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SettingsTab({ courseId, role }: { courseId: string; role: string }) {
  const queryClient = useQueryClient()
  const completion = useQuery(completionSettingsQueryOptions(courseId))
  const detailsQuery = useQuery(courseDetailsQueryOptions(courseId))
  const [rule, setRule] = useState<'all_lessons' | 'min_percent_quiz'>('all_lessons')
  const [minPercent, setMinPercent] = useState(80)
  const [autoIssue, setAutoIssue] = useState(true)
  const [certificateTitle, setCertificateTitle] = useState('')
  const [signatureLabel, setSignatureLabel] = useState('')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (hydrated || !completion.data) return
    setRule(completion.data.rule)
    setMinPercent(completion.data.minPercent)
    setAutoIssue(completion.data.autoIssue)
    setCertificateTitle(completion.data.certificate?.title ?? 'Certificate of Completion')
    setSignatureLabel(completion.data.certificate?.signatureLabel ?? '')
    setHydrated(true)
  }, [hydrated, completion.data])

  const gate = useMutation({
    mutationFn: async (requiresApproval: boolean) => {
      const { setApprovalGate } = await import('../server/all')
      return setApprovalGate({ data: { coursePublicId: courseId, requiresApproval } })
    },
    onSuccess: (_, requiresApproval) => {
      void queryClient.invalidateQueries({ queryKey: courseQueryKeys.details(courseId) })
      toast.success(requiresApproval ? 'Approval workflow enabled.' : 'Approval workflow disabled.')
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Failed'),
  })

  const saveCompletion = useMutation({
    mutationFn: async () => {
      const { saveCompletionSettings } = await import('../server/all')
      return saveCompletionSettings({
        data: {
          coursePublicId: courseId,
          rule,
          minPercent,
          autoIssue,
          certificate: {
            title: certificateTitle,
            showStudentName: true,
            showCourseTitle: true,
            showCompletionDate: true,
            showSignature: true,
            signatureObjectKey: null,
            signatureLabel: signatureLabel || null,
          },
        },
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: courseQueryKeys.completion(courseId) })
      toast.success('Completion rules saved.')
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Failed'),
  })

  if (completion.isPending) return <Spinner className="mx-auto my-8" />
  if (completion.isError) return <RetryErrorState onRetry={() => void completion.refetch()} />

  const details = detailsQuery.data

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section
        className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm"
        aria-label="Completion rules"
      >
        <h2 className="font-semibold">Completion Rules</h2>
        <fieldset>
          <legend className="text-sm font-medium">A course counts as complete when…</legend>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="rule"
              checked={rule === 'all_lessons'}
              onChange={() => setRule('all_lessons')}
            />
            100% of lessons are completed
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="rule"
              checked={rule === 'min_percent_quiz'}
              onChange={() => setRule('min_percent_quiz')}
            />
            Minimum
            <Input
              type="number"
              min="1"
              max="100"
              className="h-8 w-20"
              aria-label="Minimum progress percent"
              value={minPercent}
              disabled={rule !== 'min_percent_quiz'}
              onChange={(event) => setMinPercent(Number(event.target.value) || 80)}
            />
            % + passing final quiz
          </label>
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoIssue}
            onChange={(event) => setAutoIssue(event.target.checked)}
          />
          Issue certificates automatically on completion
        </label>

        <h3 className="pt-2 font-medium">Certificate Template</h3>
        <div className="rounded-xl border bg-gradient-to-br from-amber-50 to-amber-100 p-4 dark:from-amber-950 dark:to-amber-900">
          <p className="text-center font-serif text-lg font-semibold">
            {certificateTitle || 'Certificate of Completion'}
          </p>
          <div className="mt-2 text-center text-xs text-muted-foreground">
            <p>Awarded to [Student Name]</p>
            <p>for completing [Course Title]</p>
            <p>on [Completion Date]</p>
            <p className="mt-2 italic">{signatureLabel || 'Authorized signature'}</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label htmlFor="cert-title">Certificate title</Label>
            <Input
              id="cert-title"
              value={certificateTitle}
              onChange={(event) => setCertificateTitle(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="cert-signature">Signature label</Label>
            <Input
              id="cert-signature"
              placeholder="Dr. Alemayehu, Director"
              value={signatureLabel}
              onChange={(event) => setSignatureLabel(event.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Signature image upload appears once object storage (STORAGE_*) is configured; the fields
          above persist to the certificate template either way.
        </p>
        <Button
          className="self-end"
          onClick={() => saveCompletion.mutate()}
          disabled={saveCompletion.isPending}
        >
          {saveCompletion.isPending ? <Spinner className="size-4" /> : null}
          Save Rules
        </Button>
      </section>

      <section
        className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm"
        aria-label="Workflow settings"
      >
        <h2 className="font-semibold">Publication Workflow</h2>
        {role === 'admin' ? (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={details?.requiresApproval ?? false}
              onChange={(event) => gate.mutate(event.target.checked)}
            />
            <span>
              Require lesson approval before publishing
              <span className="block text-xs text-muted-foreground">
                Draft → In Review → Changes Requested → Approved → Published. Manage the queue in
                the Approval Queue.
              </span>
            </span>
          </label>
        ) : (
          <p className="text-sm text-muted-foreground">
            Approval gating is {details?.requiresApproval ? 'enabled' : 'disabled'} (admins only can
            change this).
          </p>
        )}
        {details?.requiresApproval ? (
          <Link to="/courses/reviews" className="text-sm text-violet-600 hover:underline">
            Open the Approval Queue →
          </Link>
        ) : null}
      </section>
    </div>
  )
}
