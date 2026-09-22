import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { MoreHorizontalIcon, PlusIcon, SearchIcon, UsersIcon } from 'lucide-react'
import { useRole } from '#/features/auth'
import { buildCsv, downloadCsv } from '#/features/dashboard/dashboard.export-csv'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Input } from '#/components/ui/input'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  cohortsQueryOptions,
  directoryQueryOptions,
  directoryStatsQueryOptions,
  enrollableCoursesQueryOptions,
} from '../hooks/students.queries'
import { useSetStudentStatus, useUpdateCohortMembers } from '../hooks/students.mutations'
import type { DirectoryQuery, StudentSortValue } from '../schemas/students.schema'
import type { StudentDirectoryItem } from '../students.types'
import { StudentsStatCards } from './students.stat-cards'
import { StudentsStatusBadge } from './students.status-badge'
import { StudentsAddStudentModal } from './students.add-student-modal'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { StudentsEnrollDialog } from './students.enroll-dialog'

/**
 * S-4.1 Student Directory: search, course/status filters, sortable columns,
 * row selection with bulk actions (enroll, export), stats row, pagination.
 */
export function StudentsDirectoryView({ query }: { query: DirectoryQuery }) {
  const role = useRole()
  const canWrite = role === 'admin' || role === 'editor'
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [bulkEnrollOpen, setBulkEnrollOpen] = useState(false)
  const [bulkCohortOpen, setBulkCohortOpen] = useState(false)
  const [statusTarget, setStatusTarget] = useState<StudentDirectoryItem | null>(null)
  const [statusNext, setStatusNext] = useState<'active' | 'suspended' | null>(null)

  const listQuery = useQuery(directoryQueryOptions(query))
  const statsQuery = useQuery(directoryStatsQueryOptions())
  const coursesQuery = useQuery(enrollableCoursesQueryOptions())
  const statusMutation = useSetStudentStatus()

  const patchSearch = (patch: Partial<DirectoryQuery>) => {
    void navigate({
      to: '/students',
      search: { ...query, ...patch, page: 'page' in patch ? patch.page : undefined },
    })
    setSelected(new Set())
  }

  const items = listQuery.data?.items ?? []
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id))

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)))
  }
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exportCsv = () => {
    const rows = items.filter((item) => selected.size === 0 || selected.has(item.id))
    if (rows.length === 0) return
    const csv = buildCsv(rows, [
      { header: 'Name', value: (row) => row.name },
      { header: 'Email', value: (row) => row.email },
      { header: 'Status', value: (row) => row.status },
      { header: 'Courses', value: (row) => String(row.courseCount) },
      {
        header: 'Avg Progress %',
        value: (row) => (row.avgProgress == null ? '' : String(row.avgProgress)),
      },
      { header: 'Last Active', value: (row) => row.lastActivityAt ?? '' },
      { header: 'Joined', value: (row) => row.joinedAt.slice(0, 10) },
    ])
    downloadCsv(`students-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  const sortOptions: Array<{ value: StudentSortValue; label: string }> = useMemo(
    () => [
      { value: 'name', label: 'Name' },
      { value: 'joined', label: 'Newest joined' },
      { value: 'last_active', label: 'Last active' },
      { value: 'courses', label: 'Most courses' },
      { value: 'progress', label: 'Highest progress' },
    ],
    [],
  )

  const setSearch = (value: string) => {
    void navigate({
      to: '/students',
      search: { ...query, q: value || undefined, page: undefined },
    })
  }

  const page = listQuery.data?.page ?? query.page ?? 1
  const totalRows = listQuery.data?.totalRows ?? 0
  const hasNextPage = listQuery.data?.hasNextPage ?? false
  const rangeStart = totalRows === 0 ? 0 : (page - 1) * 25 + 1
  const rangeEnd = Math.min(page * 25, totalRows)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Students</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StudentsAddStudentModal open={addOpen} onOpenChange={setAddOpen} />
          {canWrite && (
            <Button variant="outline" onClick={() => setAddOpen(true)}>
              <PlusIcon aria-hidden /> Add Student
            </Button>
          )}
          {canWrite && (
            <Button
              variant="outline"
              onClick={() => {
                // S-4.4 Create Cohort: land on the cohorts screen.
                void navigate({ to: '/students/cohorts' })
              }}
            >
              <PlusIcon aria-hidden /> Create Cohort
            </Button>
          )}
        </div>
      </div>

      <StudentsStatCards stats={statsQuery.data} />

      {/* Toolbar */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <SearchIcon
            aria-hidden
            className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query.q ?? ''}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setSearch('')
            }}
            placeholder="Search by name or email…"
            aria-label="Search students"
            className="pl-8"
          />
        </div>
        <select
          aria-label="Filter by course"
          value={query.course ?? 'all'}
          onChange={(event) => patchSearch({ course: event.target.value })}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All Courses</option>
          {(coursesQuery.data ?? []).map((course) => (
            <option key={course.publicId} value={course.publicId}>
              {course.title}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          value={query.status ?? 'all'}
          onChange={(event) =>
            patchSearch({
              status: event.target.value as
                'active' | 'locked' | 'suspended' | 'pending_verification' | 'all',
            })
          }
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="pending_verification">Invite pending</option>
          <option value="locked">Locked</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          aria-label="Sort students"
          value={query.sort ?? 'name'}
          onChange={(event) => patchSearch({ sort: event.target.value as StudentSortValue })}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              Sort: {option.label}
            </option>
          ))}
        </select>
        <Button variant="outline" onClick={exportCsv} disabled={items.length === 0}>
          Export CSV
        </Button>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="mt-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2"
        >
          <span className="text-sm font-medium">{selected.size} selected</span>
          {canWrite && (
            <>
              <Button size="sm" variant="outline" onClick={() => setBulkEnrollOpen(true)}>
                Enroll in Course
              </Button>
              <Button size="sm" variant="outline" onClick={() => setBulkCohortOpen(true)}>
                Add to Cohort
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={exportCsv}>
            Export Selection
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="mt-3 overflow-hidden rounded-lg border">
        {listQuery.isPending ? (
          <div className="p-4" role="status" aria-label="Loading students">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="mb-2 h-10 w-full" />
            ))}
          </div>
        ) : listQuery.isError ? (
          <RetryErrorState
            title="Unable to load students"
            description="Retry?"
            onRetry={() => void listQuery.refetch()}
            isRetrying={listQuery.isFetching}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<UsersIcon className="size-10 text-muted-foreground" />}
            title={
              query.q || query.course !== 'all' || (query.status && query.status !== 'all')
                ? 'No students match your filters'
                : 'No students enrolled yet'
            }
            description={
              query.q || query.course !== 'all' || (query.status && query.status !== 'all')
                ? 'Try a different search or clear the filters.'
                : 'Invite your first student with the Add Student button.'
            }
            variant="standard"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all students on this page"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="size-4 cursor-pointer accent-[var(--primary)]"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Courses</TableHead>
                <TableHead className="text-right">Progress</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="group">
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Select ${item.name}`}
                      checked={selected.has(item.id)}
                      onChange={() => toggleOne(item.id)}
                      className="size-4 cursor-pointer accent-[var(--primary)]"
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      to="/students/$studentId"
                      params={{ studentId: item.id }}
                      className="flex items-center gap-2 font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Avatar className="size-7">
                        <AvatarFallback className="text-xs">
                          {item.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {item.name}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-52 truncate text-muted-foreground">
                    {item.email}
                  </TableCell>
                  <TableCell>
                    <StudentsStatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.courseCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.avgProgress == null ? '—' : `${item.avgProgress}%`}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.lastActivityAt ? relativeDay(item.lastActivityAt) : 'Never'}
                  </TableCell>
                  <TableCell>
                    {canWrite && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Actions for ${item.name}`}
                              className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                            >
                              <MoreHorizontalIcon aria-hidden />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              void navigate({
                                to: '/students/$studentId',
                                params: { studentId: item.id },
                              })
                            }
                          >
                            View profile
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={item.status === 'suspended'}
                            onClick={() => {
                              setStatusTarget(item)
                              setStatusNext('suspended')
                            }}
                          >
                            Suspend account
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={item.status === 'active'}
                            onClick={() => {
                              setStatusTarget(item)
                              setStatusNext('active')
                            }}
                          >
                            Reactivate account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination: "1-25 of 1,234 students" */}
      {!listQuery.isPending && !listQuery.isError && items.length > 0 && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {rangeStart.toLocaleString()}-{rangeEnd.toLocaleString()} of{' '}
            {totalRows.toLocaleString()} students
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => patchSearch({ page: page - 1 })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNextPage}
              onClick={() => patchSearch({ page: page + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <StudentsEnrollDialog
        open={bulkEnrollOpen}
        onOpenChange={setBulkEnrollOpen}
        studentIds={Array.from(selected)}
        onDone={() => setSelected(new Set())}
      />

      {canWrite && (
        <StudentsBulkCohortDialog
          open={bulkCohortOpen}
          onOpenChange={setBulkCohortOpen}
          studentIds={Array.from(selected)}
          onDone={() => setSelected(new Set())}
        />
      )}

      {/* Suspend/reactivate confirmation */}
      <ConfirmDialog
        open={statusTarget != null && statusNext != null}
        onOpenChange={(open) => {
          if (!open) {
            setStatusTarget(null)
            setStatusNext(null)
          }
        }}
        title={statusNext === 'suspended' ? 'Suspend this student?' : 'Reactivate this student?'}
        body={
          statusNext === 'suspended'
            ? `${statusTarget?.name ?? 'This student'} will lose access to courses until reactivated.`
            : `${statusTarget?.name ?? 'This student'} will regain access to their courses.`
        }
        confirmLabel={statusNext === 'suspended' ? 'Suspend' : 'Reactivate'}
        destructive={statusNext === 'suspended'}
        onConfirm={() => {
          if (statusTarget == null || statusNext == null) return
          statusMutation.mutate({ studentId: statusTarget.id, status: statusNext })
          setStatusTarget(null)
          setStatusNext(null)
        }}
      />
    </div>
  )
}

/** Bulk "Add to cohort": pick a cohort for the selected students (S-4.1). */
function StudentsBulkCohortDialog({
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
  const cohortsQuery = useQuery({ ...cohortsQueryOptions({}), enabled: open })
  const addMutation = useUpdateCohortMembers()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add {studentIds.length} students to cohort</DialogTitle>
          <DialogDescription>Students keep all existing cohort memberships.</DialogDescription>
        </DialogHeader>
        <fieldset className="grid gap-2">
          <legend className="sr-only">Cohort</legend>
          {(cohortsQuery.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No cohorts yet — create one on the Cohorts screen first.
            </p>
          ) : (
            (cohortsQuery.data?.items ?? []).map((cohort) => (
              <button
                key={cohort.publicId}
                type="button"
                disabled={addMutation.isPending}
                onClick={() =>
                  addMutation.mutate(
                    {
                      cohortPublicId: cohort.publicId,
                      addStudentIds: studentIds,
                      removeStudentIds: [],
                    },
                    {
                      onSuccess: () => {
                        onOpenChange(false)
                        onDone?.()
                      },
                    },
                  )
                }
                className="flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-medium">{cohort.name}</span>
                <span className="text-xs text-muted-foreground">{cohort.memberCount} students</span>
              </button>
            ))
          )}
        </fieldset>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function relativeDay(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
