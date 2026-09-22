import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { CalendarIcon, MailIcon, MessageSquareIcon, PencilIcon, PhoneIcon } from 'lucide-react'
import { useRole } from '#/features/auth'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Button, buttonVariants } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  studentActivityQueryOptions,
  studentCoursesQueryOptions,
  studentProfileQueryOptions,
  studentThreadsQueryOptions,
} from '../hooks/students.queries'
import {
  useAddStudentTag,
  useRemoveStudentTag,
  useUnenrollStudent,
} from '../hooks/students.mutations'
import { ACTIVITY_KIND_LABELS } from '../students.activity'
import { formatPercent } from '#/lib/format'
import { StudentsStatusBadge } from './students.status-badge'
import { StudentsEnrollDialog } from './students.enroll-dialog'
import { StudentsProfileEditDialog } from './students.profile-edit-dialog'

/**
 * S-4.2 Student Profile: identity card with inline edit + message, and the
 * Courses / Progress / Activity Log / Messages tabs. Progress links to the
 * dedicated S-4.3 dashboard.
 */
export function StudentsProfileView({ studentId }: { studentId: string }) {
  const role = useRole()
  const canWrite = role === 'admin' || role === 'editor'
  const canMessage = role === 'admin' || role === 'support'

  const profileQuery = useQuery(studentProfileQueryOptions({ studentId }))
  const coursesQuery = useQuery(studentCoursesQueryOptions({ studentId }))
  const activityQuery = useQuery(studentActivityQueryOptions({ studentId }))
  const threadsQuery = useQuery(studentThreadsQueryOptions(studentId))
  const removeTag = useRemoveStudentTag()
  const addTag = useAddStudentTag()
  const unenroll = useUnenrollStudent()
  const [tagDraft, setTagDraft] = useState('')
  const [unenrollTarget, setUnenrollTarget] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const profile = profileQuery.data

  if (profileQuery.isPending) {
    return (
      <div className="grid gap-4" role="status" aria-label="Loading student profile">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (profileQuery.isError || !profile) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-6">
        <p className="font-medium">Unable to load this student.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The student may not exist or you may not have access.
        </p>
        <Link
          to="/students"
          className={buttonVariants({ variant: 'outline', size: 'sm', className: 'mt-3' })}
        >
          Back to directory
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link to="/students" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          ← Students
        </Link>
      </div>

      {/* Student card */}
      <div className="rounded-lg border p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="text-lg">
                {profile.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold">{profile.name}</h1>
                <StudentsStatusBadge status={profile.status} />
              </div>
              <div className="mt-1.5 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                <span className="flex items-center gap-1.5">
                  <MailIcon aria-hidden className="size-3.5" /> {profile.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <PhoneIcon aria-hidden className="size-3.5" />
                  {profile.phoneLast4 ? `•••• ${profile.phoneLast4}` : 'No phone on file'}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarIcon aria-hidden className="size-3.5" /> Joined{' '}
                  {profile.joinedAt.slice(0, 10)}
                </span>
                <span>
                  Last active:{' '}
                  {profile.lastActivityAt ? relativeDay(profile.lastActivityAt) : 'Never'}
                </span>
              </div>
              {(profile.tags.length > 0 || canWrite) && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {profile.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      {canWrite && (
                        <button
                          type="button"
                          aria-label={`Remove tag ${tag}`}
                          onClick={() => removeTag.mutate({ studentId, tag })}
                          className="ml-0.5 rounded-full px-1 text-xs hover:bg-foreground/10"
                        >
                          ×
                        </button>
                      )}
                    </Badge>
                  ))}
                  {canWrite && (
                    <form
                      className="flex items-center gap-1"
                      onSubmit={(event) => {
                        event.preventDefault()
                        const tag = tagDraft.trim()
                        if (!tag) return
                        addTag.mutate({ studentId, tag }, { onSuccess: () => setTagDraft('') })
                      }}
                    >
                      <input
                        value={tagDraft}
                        onChange={(event) => setTagDraft(event.target.value)}
                        placeholder="Add tag…"
                        aria-label="Add tag"
                        className="h-6 w-24 rounded-full border bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      {tagDraft.trim() && (
                        <button
                          type="submit"
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Add
                        </button>
                      )}
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canWrite && (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <PencilIcon aria-hidden /> Edit
              </Button>
            )}
            {canMessage && (
              <Link
                to="/students/messaging"
                search={{ student: studentId }}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <MessageSquareIcon aria-hidden /> Message
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="courses" className="mt-5">
        <TabsList>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        {/* Courses tab */}
        <TabsContent value="courses" className="mt-4">
          {coursesQuery.isPending ? (
            <Skeleton className="h-48 w-full" />
          ) : (coursesQuery.data ?? []).length === 0 ? (
            <div className="rounded-lg border p-8 text-center">
              <p className="font-medium">Not enrolled in any courses yet.</p>
              {canWrite && (
                <Button size="sm" className="mt-3" onClick={() => setEnrollOpen(true)}>
                  Enroll in New Course
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">
                      Course
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right">
                      Progress
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right">
                      Completion
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(coursesQuery.data ?? []).map((row) => (
                    <tr key={row.enrollmentPublicId} className="border-t">
                      <td className="px-4 py-3">
                        <Link
                          to="/courses/$courseId"
                          params={{ courseId: row.coursePublicId }}
                          className="font-medium hover:underline"
                        >
                          {row.courseTitle}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatPercent(row.progressPercentage)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {row.totalLessons > 0 ? `${row.completedLessons}/${row.totalLessons}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {row.isCompleted ? (
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            🏆 Done
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Active</Badge>
                        )}
                      </td>
                      {canWrite && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className="text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                            onClick={() => setUnenrollTarget(row.courseTitle)}
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {canWrite && (coursesQuery.data ?? []).length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => setEnrollOpen(true)}
            >
              Enroll in New Course
            </Button>
          )}
        </TabsContent>

        {/* Progress tab → S-4.3 */}
        <TabsContent value="progress" className="mt-4">
          <div className="rounded-lg border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              A focused, chart-driven view of this student's learning progress.
            </p>
            <Link
              to="/students/$studentId/progress"
              params={{ studentId }}
              className={buttonVariants({ size: 'sm' })}
            >
              Open Progress Dashboard
            </Link>
          </div>
        </TabsContent>

        {/* Activity Log tab */}
        <TabsContent value="activity" className="mt-4">
          {activityQuery.isPending ? (
            <Skeleton className="h-48 w-full" />
          ) : (activityQuery.data ?? []).length === 0 ? (
            <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
              No activity recorded since enrollment.
            </div>
          ) : (
            <ol className="overflow-hidden rounded-lg border">
              {(activityQuery.data ?? []).map((item, index) => (
                <li
                  key={item.id}
                  className={`flex items-start justify-between gap-4 px-4 py-3 ${index > 0 ? 'border-t' : ''}`}
                >
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {ACTIVITY_KIND_LABELS[item.kind]}
                      {item.courseTitle ? ` · ${item.courseTitle}` : ''}
                      {item.detail ? ` · ${item.detail}` : ''}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {new Date(item.at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>

        {/* Messages tab */}
        <TabsContent value="messages" className="mt-4">
          {threadsQuery.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : (threadsQuery.data ?? []).length === 0 ? (
            <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
              No conversations with this student yet.
            </div>
          ) : (
            <ol className="overflow-hidden rounded-lg border">
              {(threadsQuery.data ?? []).map((thread, index) => (
                <li key={thread.publicId} className={`px-4 py-3 ${index > 0 ? 'border-t' : ''}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{thread.subject ?? 'Conversation'}</p>
                    <time className="shrink-0 text-xs text-muted-foreground">
                      {new Date(thread.lastMessageAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </time>
                  </div>
                  {thread.lastMessagePreview && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {thread.lastMessagePreview}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </TabsContent>
      </Tabs>

      <StudentsProfileEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        profile={{ id: profile.id, name: profile.name, email: profile.email }}
      />
      <ConfirmDialog
        open={unenrollTarget != null}
        onOpenChange={(open) => !open && setUnenrollTarget(null)}
        title={`Remove enrollment in ${unenrollTarget ?? 'this course'}?`}
        body="The student loses access to the course. Their progress history is retained."
        confirmLabel="Remove Enrollment"
        destructive
        onConfirm={() => {
          const target = (coursesQuery.data ?? []).find((row) => row.courseTitle === unenrollTarget)
          if (target == null) return
          unenroll.mutate({ studentId, coursePublicId: target.coursePublicId })
          setUnenrollTarget(null)
        }}
      />
      <StudentsEnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        studentIds={[studentId]}
      />
    </div>
  )
}

function relativeDay(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
