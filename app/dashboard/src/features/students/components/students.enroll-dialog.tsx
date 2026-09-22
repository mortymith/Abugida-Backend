import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SearchIcon } from 'lucide-react'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { cn } from '#/lib/utils'
import { enrollableCoursesQueryOptions } from '../hooks/students.queries'
import { useEnrollStudents } from '../hooks/students.mutations'
import type { StudentsReference } from '../students.types'

type EnrollableCourse = StudentsReference['courses'][number]

/**
 * "Enroll in New Course" dialog (S-4.2, also used for bulk enrollment from
 * S-4.1). Paid courses require the S-7.1-style confirmation that access is
 * granted at no charge.
 */
export function StudentsEnrollDialog({
  open,
  onOpenChange,
  studentIds,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentIds: string[]
  onDone?: () => void
}) {
  const [search, setSearch] = useState('')
  const [course, setCourse] = useState<EnrollableCourse | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const coursesQuery = useQuery({ ...enrollableCoursesQueryOptions(), enabled: open })
  const enrollMutation = useEnrollStudents()

  const filtered = (coursesQuery.data ?? []).filter((item) =>
    item.title.toLowerCase().includes(search.trim().toLowerCase()),
  )

  const close = () => {
    setCourse(null)
    setSearch('')
    onOpenChange(false)
  }

  const confirmEnroll = () => {
    if (!course) return
    enrollMutation.mutate(
      {
        studentIds,
        coursePublicId: course.publicId,
        acknowledgedPaid: !course.isFree,
      },
      {
        onSuccess: () => {
          setConfirmOpen(false)
          close()
          onDone?.()
        },
        onError: () => setConfirmOpen(false),
      },
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enroll in New Course</DialogTitle>
            <DialogDescription>
              {studentIds.length === 1
                ? 'Pick a published course for this student.'
                : `Pick a published course for ${studentIds.length} selected students.`}
            </DialogDescription>
          </DialogHeader>

          {coursesQuery.isPending ? (
            <div className="grid gap-2 py-2" role="status" aria-label="Loading courses">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : coursesQuery.isError ? (
            <RetryErrorState
              title="Unable to load courses"
              onRetry={() => void coursesQuery.refetch()}
              isRetrying={coursesQuery.isFetching}
            />
          ) : (
            <>
              <div className="relative">
                <SearchIcon
                  aria-hidden
                  className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search courses…"
                  aria-label="Search courses"
                  className="pl-8"
                />
              </div>
              <ul role="listbox" aria-label="Courses" className="-mx-1 flex-1 overflow-y-auto px-1">
                {filtered.length === 0 ? (
                  <li className="py-8 text-center text-sm text-muted-foreground">
                    No published courses match.
                  </li>
                ) : (
                  filtered.map((item) => {
                    const selectedCourse = course?.publicId === item.publicId
                    const full = item.capacity != null && item.activeEnrollments >= item.capacity
                    return (
                      <li key={item.publicId}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={selectedCourse}
                          onClick={() => setCourse(item)}
                          className={cn(
                            'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                            'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            selectedCourse && 'bg-muted',
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{item.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {item.activeEnrollments}
                              {item.capacity != null ? ` / ${item.capacity} seats` : ' enrolled'}
                              {full ? ' · full' : ''}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-medium">
                            {item.isFree ? 'Free' : (item.priceLabel ?? 'Paid')}
                          </span>
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              disabled={course == null || enrollMutation.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              Enroll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paid-course conflict confirmation (S-4.8 conflict copy) */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Grant paid access at no charge?"
        body={
          course?.isFree
            ? `Enroll ${studentIds.length === 1 ? 'this student' : `${studentIds.length} students`} in ${course.title}?`
            : `${course?.title ?? 'This course'} is a paid course. This will grant paid access at no charge.`
        }
        confirmLabel="Enroll"
        onConfirm={confirmEnroll}
      />
    </>
  )
}
