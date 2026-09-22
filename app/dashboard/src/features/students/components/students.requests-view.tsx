import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { CheckIcon, ClockIcon, UserCheckIcon, XIcon } from 'lucide-react'
import { useRole } from '#/features/auth'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import {
  enrollmentRequestsQueryOptions,
  waitlistOverviewQueryOptions,
} from '../hooks/students.queries'
import {
  useApproveRequest,
  useBulkApproveRequests,
  useDenyRequest,
  usePromoteFromWaitlist,
} from '../hooks/students.mutations'
import type { EnrollmentRequestItem, WaitlistOverviewItem } from '../students.types'

/**
 * S-4.6 Enrollment Requests / Waitlist: pending queue with approve/deny,
 * bulk approve, and per-course waitlist promotion when a seat opens.
 */
export function StudentsRequestsView({ query }: { query: { q?: string } }) {
  const role = useRole()
  const canDecide = role === 'admin' || role === 'editor' || role === 'support'

  const requestsQuery = useQuery(enrollmentRequestsQueryOptions(query))
  const waitlistQuery = useQuery(waitlistOverviewQueryOptions())

  const approve = useApproveRequest()
  const deny = useDenyRequest()
  const bulkApprove = useBulkApproveRequests()
  const promote = usePromoteFromWaitlist()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [promoteTarget, setPromoteTarget] = useState<WaitlistOverviewItem | null>(null)

  const items = requestsQuery.data?.items ?? []
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.publicId))

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(items.map((item) => item.publicId)))
  }
  const toggleOne = (publicId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(publicId)) next.delete(publicId)
      else next.add(publicId)
      return next
    })
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Enrollment Requests</h1>
          <p className="text-sm text-muted-foreground">
            Review requests for approval-gated courses. Approved students are enrolled automatically
            and notified.
          </p>
        </div>
        {canDecide && selected.size > 0 && (
          <Button onClick={() => setConfirmBulk(true)}>Approve All ({selected.size})</Button>
        )}
      </div>

      {/* Requests queue */}
      {requestsQuery.isPending ? (
        <Skeleton className="h-56 w-full" role="status" aria-label="Loading requests" />
      ) : requestsQuery.isError ? (
        <RetryErrorState
          title="Unable to load requests"
          description="Retry?"
          onRetry={() => void requestsQuery.refetch()}
          isRetrying={requestsQuery.isFetching}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ClockIcon className="size-10 text-muted-foreground" />}
          variant="standard"
          title="No pending requests"
          description="Enrollment requests for approval-gated courses will appear here."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {canDecide && (
                  <th scope="col" className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Select all requests"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="size-4 cursor-pointer accent-[var(--primary)]"
                    />
                  </th>
                )}
                <th scope="col" className="px-4 py-2.5">
                  Student
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Course
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Requested
                </th>
                {canDecide && (
                  <th scope="col" className="px-4 py-2.5 text-right">
                    Action
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <RequestRow
                  key={item.publicId}
                  item={item}
                  canDecide={canDecide}
                  isSelected={selected.has(item.publicId)}
                  onToggle={() => toggleOne(item.publicId)}
                  onApprove={() => approve.mutate({ requestPublicId: item.publicId })}
                  onDeny={() => deny.mutate({ requestPublicId: item.publicId })}
                  isDeciding={approve.isPending || deny.isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Waitlist */}
      <div className="mt-8">
        <h2 className="mb-2 text-lg font-semibold">Waitlist</h2>
        {waitlistQuery.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : waitlistQuery.isError ? (
          <RetryErrorState
            title="Unable to load the waitlist"
            description="Retry?"
            onRetry={() => void waitlistQuery.refetch()}
            isRetrying={waitlistQuery.isFetching}
          />
        ) : waitlistQuery.data.length === 0 ? (
          <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            No students are waiting on any course.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {waitlistQuery.data.map((course) => (
              <Card key={course.coursePublicId}>
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm font-semibold">{course.courseTitle}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge
                      variant="secondary"
                      className={
                        course.capacity != null && course.activeEnrollments >= course.capacity
                          ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          : ''
                      }
                    >
                      {course.capacity == null
                        ? `${course.activeEnrollments} enrolled`
                        : `${course.activeEnrollments}/${course.capacity} enrolled`}
                    </Badge>
                    <span className="text-muted-foreground">{course.waitingCount} waiting</span>
                  </div>
                  {course.nextStudent && (
                    <p className="text-sm">
                      Next:{' '}
                      <Link
                        to="/students/$studentId"
                        params={{ studentId: course.nextStudent.studentId }}
                        className="font-medium hover:underline"
                      >
                        {course.nextStudent.studentName}
                      </Link>
                    </p>
                  )}
                  {canDecide && course.nextStudent && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-fit"
                      onClick={() => setPromoteTarget(course)}
                    >
                      <UserCheckIcon aria-hidden /> Promote Next Student
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmBulk}
        onOpenChange={setConfirmBulk}
        title={`Approve ${selected.size} requests?`}
        body="Each approved student is enrolled in their requested course and notified automatically."
        confirmLabel="Approve All"
        onConfirm={() => {
          bulkApprove.mutate(
            { requestPublicIds: Array.from(selected) },
            { onSuccess: () => setSelected(new Set()) },
          )
          setConfirmBulk(false)
        }}
      />
      <ConfirmDialog
        open={promoteTarget != null}
        onOpenChange={(open) => !open && setPromoteTarget(null)}
        title="Promote from waitlist?"
        body={
          promoteTarget?.nextStudent
            ? `${promoteTarget.nextStudent.studentName} will be enrolled in ${promoteTarget.courseTitle} and notified.`
            : ''
        }
        confirmLabel="Promote"
        onConfirm={() => {
          if (promoteTarget == null) return
          promote.mutate({ coursePublicId: promoteTarget.coursePublicId })
          setPromoteTarget(null)
        }}
      />
    </div>
  )
}

function RequestRow({
  item,
  canDecide,
  isSelected,
  onToggle,
  onApprove,
  onDeny,
  isDeciding,
}: {
  item: EnrollmentRequestItem
  canDecide: boolean
  isSelected: boolean
  onToggle: () => void
  onApprove: () => void
  onDeny: () => void
  isDeciding: boolean
}) {
  return (
    <tr className="border-t transition-colors hover:bg-muted/40">
      {canDecide && (
        <td className="px-3 py-2.5">
          <input
            type="checkbox"
            aria-label={`Select request from ${item.studentName}`}
            checked={isSelected}
            onChange={onToggle}
            className="size-4 cursor-pointer accent-[var(--primary)]"
          />
        </td>
      )}
      <td className="px-4 py-2.5">
        <Link
          to="/students/$studentId"
          params={{ studentId: item.studentId }}
          className="font-medium hover:underline"
        >
          {item.studentName}
        </Link>
        <span className="block text-xs text-muted-foreground">{item.studentEmail}</span>
      </td>
      <td className="px-4 py-2.5">{item.courseTitle}</td>
      <td className="px-4 py-2.5 text-muted-foreground">
        {new Date(item.requestedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </td>
      {canDecide && (
        <td className="px-4 py-2.5">
          <div className="flex justify-end gap-1.5">
            <Button size="xs" variant="outline" disabled={isDeciding} onClick={onApprove}>
              <CheckIcon aria-hidden className="size-3.5" /> Approve
            </Button>
            <Button
              size="xs"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={isDeciding}
              onClick={onDeny}
            >
              <XIcon aria-hidden className="size-3.5" /> Deny
            </Button>
          </div>
        </td>
      )}
    </tr>
  )
}
