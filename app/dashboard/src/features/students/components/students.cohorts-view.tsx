import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpenIcon,
  Loader2Icon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react'
import { useRole } from '#/features/auth'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '#/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Skeleton } from '#/components/ui/skeleton'
import { Textarea } from '#/components/ui/textarea'
import { formatPercent } from '#/lib/format'
import {
  cohortCandidatesQueryOptions,
  cohortsQueryOptions,
  cohortMembersQueryOptions,
} from '../hooks/students.queries'
import {
  useCreateCohort,
  useDeleteCohort,
  useUpdateCohort,
  useUpdateCohortMembers,
} from '../hooks/students.mutations'
import type { CohortsQuery } from '../schemas/students.schema'
import type { CohortCard } from '../students.types'

/**
 * S-4.4 Cohort Management: cohort cards with size and average progress,
 * create/edit/delete, membership management, and broadcast hand-off.
 */
export function StudentsCohortsView({ query }: { query: CohortsQuery }) {
  const role = useRole()
  const canWrite = role === 'admin' || role === 'editor'

  const cohortsQuery = useQuery(cohortsQueryOptions(query))
  const [createOpen, setCreateOpen] = useState(false)
  const [manageTarget, setManageTarget] = useState<CohortCard | null>(null)

  const cohorts = cohortsQuery.data?.items ?? []

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cohorts</h1>
          <p className="text-sm text-muted-foreground">
            Group students for batch enrollment, communication, and progress tracking.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon aria-hidden /> Create Cohort
          </Button>
        )}
      </div>

      {cohortsQuery.isPending ? (
        <div
          className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
          role="status"
          aria-label="Loading cohorts"
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-44" />
          ))}
        </div>
      ) : cohortsQuery.isError ? (
        <RetryErrorState
          title="Unable to load cohorts"
          description="Retry?"
          onRetry={() => void cohortsQuery.refetch()}
          isRetrying={cohortsQuery.isFetching}
        />
      ) : cohorts.length === 0 ? (
        <EmptyState
          icon={<BookOpenIcon className="size-10 text-muted-foreground" />}
          variant="standard"
          title="No cohorts created yet"
          description="Create your first cohort to organize students into groups."
          action={
            canWrite ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Create Cohort
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {cohorts.map((cohort) => (
            <Card key={cohort.publicId}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpenIcon aria-hidden className="size-4 text-primary" />
                  {cohort.name}
                </CardTitle>
                {cohort.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{cohort.description}</p>
                )}
              </CardHeader>
              <CardContent className="grid gap-1.5 text-sm">
                <span className="flex items-center gap-1.5">
                  <UsersIcon aria-hidden className="size-4 text-muted-foreground" />
                  {cohort.memberCount} students
                </span>
                <span className="text-muted-foreground">
                  {cohort.avgProgress == null
                    ? 'No progress yet'
                    : `${formatPercent(cohort.avgProgress)} Avg Progress`}
                </span>
                {cohort.startedAt && (
                  <span className="text-muted-foreground">Started: {cohort.startedAt}</span>
                )}
              </CardContent>
              <CardFooter className="gap-2">
                <Button size="sm" variant="outline" onClick={() => setManageTarget(cohort)}>
                  <SettingsIcon aria-hidden /> Manage
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <StudentsCohortDialog open={createOpen} onOpenChange={setCreateOpen} />
      <StudentsCohortManageDialog cohort={manageTarget} onClose={() => setManageTarget(null)} />
    </div>
  )
}

/** Cohort create/edit form (S-4.4 creation modal). */
export function StudentsCohortDialog({
  open,
  onOpenChange,
  cohort,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cohort?: CohortCard
}) {
  const [name, setName] = useState(cohort?.name ?? '')
  const [description, setDescription] = useState(cohort?.description ?? '')
  const [startedAt, setStartedAt] = useState(cohort?.startedAt ?? '')

  const createMutation = useCreateCohort()
  const updateMutation = useUpdateCohort()
  const isEdit = cohort != null
  const pending = createMutation.isPending || updateMutation.isPending

  // Reset fields whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setName(cohort?.name ?? '')
      setDescription(cohort?.description ?? '')
      setStartedAt(cohort?.startedAt ?? '')
    }
  }, [open, cohort?.name, cohort?.description, cohort?.startedAt])

  const submit = () => {
    if (!name.trim()) return
    if (cohort != null) {
      updateMutation.mutate(
        {
          cohortPublicId: cohort.publicId,
          name: name.trim(),
          description: description.trim() || null,
          startedAt: startedAt || null,
        },
        { onSuccess: () => onOpenChange(false) },
      )
    } else {
      createMutation.mutate(
        {
          name: name.trim(),
          description: description.trim() || null,
          startedAt: startedAt || null,
          studentIds: [],
        },
        { onSuccess: () => onOpenChange(false) },
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Cohort' : 'Create Cohort'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the cohort details.' : 'Add students after creating the cohort.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="cohort-name">
              Cohort name{' '}
              <span aria-hidden className="text-destructive">
                *
              </span>
            </Label>
            <Input
              id="cohort-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="TOEFL Jan 2026"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cohort-description">Description</Label>
            <Textarea
              id="cohort-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cohort-started">Start date</Label>
            <Input
              id="cohort-started"
              type="date"
              value={startedAt}
              onChange={(event) => setStartedAt(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending && <Loader2Icon aria-hidden className="size-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Cohort'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Manage dialog: add/remove members + delete cohort. */
export function StudentsCohortManageDialog({
  cohort,
  onClose,
}: {
  cohort: CohortCard | null
  onClose: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [candidateSearch, setCandidateSearch] = useState('')
  const [pendingAdds, setPendingAdds] = useState<Set<string>>(new Set())

  const membersQuery = useQuery({
    ...cohortMembersQueryOptions(cohort?.publicId ?? ''),
    enabled: cohort != null,
  })
  const candidatesQuery = useQuery({
    ...cohortCandidatesQueryOptions(candidateSearch),
    enabled: cohort != null,
  })
  const membersMutation = useUpdateCohortMembers()
  const deleteMutation = useDeleteCohort()

  if (cohort == null) return null

  const members = membersQuery.data ?? []
  const memberIds = new Set(members.map((member) => member.studentId))

  const flushAdds = () => {
    if (pendingAdds.size === 0) return
    membersMutation.mutate(
      {
        cohortPublicId: cohort.publicId,
        addStudentIds: Array.from(pendingAdds),
        removeStudentIds: [],
      },
      { onSuccess: () => setPendingAdds(new Set()) },
    )
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Manage — {cohort.name}</DialogTitle>
            <DialogDescription>
              {cohort.memberCount} students ·{' '}
              {cohort.avgProgress == null
                ? 'no progress yet'
                : `${formatPercent(cohort.avgProgress)} avg progress`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 gap-4 sm:grid-cols-2">
            {/* Current members */}
            <div className="flex min-h-0 flex-col">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Members
              </h3>
              <ul className="min-h-32 flex-1 overflow-y-auto rounded-md border" role="list">
                {membersQuery.isPending ? (
                  <li className="p-3 text-sm text-muted-foreground" role="status">
                    Loading…
                  </li>
                ) : members.length === 0 ? (
                  <li className="p-3 text-sm text-muted-foreground">No students yet.</li>
                ) : (
                  members.map((member) => (
                    <li
                      key={member.studentId}
                      className="flex items-center justify-between gap-2 border-b px-3 py-2 last:border-b-0"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{member.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {member.email}
                        </span>
                      </span>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() =>
                          membersMutation.mutate({
                            cohortPublicId: cohort.publicId,
                            addStudentIds: [],
                            removeStudentIds: [member.studentId],
                          })
                        }
                      >
                        Remove
                      </Button>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Add students */}
            <div className="flex min-h-0 flex-col">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Add Students
              </h3>
              <div className="relative mb-2">
                <SearchIcon
                  aria-hidden
                  className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="search"
                  value={candidateSearch}
                  onChange={(event) => setCandidateSearch(event.target.value)}
                  placeholder="Search students…"
                  aria-label="Search students to add"
                  className="pl-8"
                />
              </div>
              <ul
                className="min-h-32 flex-1 overflow-y-auto rounded-md border"
                role="listbox"
                aria-label="Candidate students"
              >
                {(candidatesQuery.data ?? [])
                  .filter((candidate) => !memberIds.has(candidate.id))
                  .map((candidate) => (
                    <li key={candidate.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={pendingAdds.has(candidate.id)}
                        onClick={() =>
                          setPendingAdds((prev) => {
                            const next = new Set(prev)
                            if (next.has(candidate.id)) next.delete(candidate.id)
                            else next.add(candidate.id)
                            return next
                          })
                        }
                        className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {candidate.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {candidate.email}
                          </span>
                        </span>
                        {pendingAdds.has(candidate.id) && (
                          <span className="text-xs font-medium text-primary">Selected</span>
                        )}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          <DialogFooter className="items-center justify-between sm:justify-between">
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              Delete Cohort
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Done
              </Button>
              <Button
                disabled={pendingAdds.size === 0 || membersMutation.isPending}
                onClick={flushAdds}
              >
                {membersMutation.isPending && (
                  <Loader2Icon aria-hidden className="size-4 animate-spin" />
                )}
                Add {pendingAdds.size || ''}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${cohort.name}?`}
        body="Students keep their enrollments; only the cohort group is removed."
        confirmLabel="Delete Cohort"
        destructive
        onConfirm={() => {
          deleteMutation.mutate(
            { cohortPublicId: cohort.publicId },
            { onSuccess: () => setConfirmDelete(false) },
          )
        }}
      />
    </>
  )
}
