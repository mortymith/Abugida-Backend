import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Loader2Icon, PlusIcon, SearchIcon, SparklesIcon } from 'lucide-react'
import { useRole } from '#/features/auth'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '#/components/ui/card'
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
import {
  badgeHistoryQueryOptions,
  badgesQueryOptions,
  cohortCandidatesQueryOptions,
} from '../hooks/students.queries'
import {
  useAwardBadge,
  useEvaluateBadges,
  useSaveBadge,
  useSetBadgeStatus,
} from '../hooks/students.mutations'
import { previewBadgeTrigger } from '../server/all'
import { BADGE_TRIGGER_LABELS, triggerPreviewMessage } from '../students.badge-triggers'
import type { BadgeCard, TriggerPreviewResult } from '../students.types'
import type { BadgeTrigger } from '@abugida/database/learning'

const MANUAL_AWARD_CONFIRM_THRESHOLD = 25

/**
 * S-4.7 Badges & Achievements: badge grid sorted by total awards, editor
 * with one trigger per badge, pause/archive, manual award with confirmation
 * above 25 students, and the award history table.
 */
export function StudentsBadgesView() {
  const role = useRole()
  const canWrite = role === 'admin' || role === 'editor'

  const badgesQuery = useQuery(badgesQueryOptions())
  const historyQuery = useQuery(badgeHistoryQueryOptions({}))
  const evaluate = useEvaluateBadges()
  const setBadgeStatus = useSetBadgeStatus()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<BadgeCard | null>(null)
  const [awardTarget, setAwardTarget] = useState<BadgeCard | null>(null)
  const [pauseTarget, setPauseTarget] = useState<BadgeCard | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<BadgeCard | null>(null)

  const items = badgesQuery.data?.items ?? []

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Badges & Achievements</h1>
          <p className="text-sm text-muted-foreground">
            Reward milestones — triggers evaluate automatically, or award manually.
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => evaluate.mutate()}
              disabled={evaluate.isPending}
            >
              {evaluate.isPending ? (
                <Loader2Icon aria-hidden className="size-4 animate-spin" />
              ) : (
                <SparklesIcon aria-hidden />
              )}
              Evaluate Now
            </Button>
            <Button
              onClick={() => {
                setEditTarget(null)
                setEditorOpen(true)
              }}
            >
              <PlusIcon aria-hidden /> Create Badge
            </Button>
          </div>
        )}
      </div>

      {badgesQuery.isPending ? (
        <div
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          role="status"
          aria-label="Loading badges"
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-44" />
          ))}
        </div>
      ) : badgesQuery.isError ? (
        <RetryErrorState
          title="Unable to load badges"
          description="Retry?"
          onRetry={() => void badgesQuery.refetch()}
          isRetrying={badgesQuery.isFetching}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<SparklesIcon className="size-10 text-muted-foreground" />}
          variant="standard"
          title="No badges created yet"
          description="Create your first badge to reward student milestones."
          action={
            canWrite ? (
              <Button
                size="sm"
                onClick={() => {
                  setEditTarget(null)
                  setEditorOpen(true)
                }}
              >
                Create Badge
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((badge) => (
            <Card key={badge.publicId} className="flex flex-col">
              <CardHeader className="items-center pb-2 text-center">
                <span className="text-3xl" aria-hidden>
                  {badge.icon ?? '🏅'}
                </span>
                <p className="font-semibold">{badge.name}</p>
                {badge.description && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{badge.description}</p>
                )}
              </CardHeader>
              <CardContent className="grid flex-1 content-start gap-1.5 text-center text-xs text-muted-foreground">
                <p>
                  Trigger:{' '}
                  <span className="font-medium text-foreground">
                    {badge.triggerKind === 'streak' && badge.triggerDays != null
                      ? `${badge.triggerDays}-day streak`
                      : BADGE_TRIGGER_LABELS[badge.triggerKind]}
                  </span>
                </p>
                <p>
                  {badge.awardCount} award{badge.awardCount === 1 ? '' : 's'}
                  {badge.lastAwardedAt ? ` · last ${badge.lastAwardedAt.slice(0, 10)}` : ''}
                </p>
              </CardContent>
              <CardFooter className="flex-col gap-2">
                <Badge
                  variant="secondary"
                  className={
                    badge.status === 'active'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : badge.status === 'paused'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-muted text-muted-foreground'
                  }
                >
                  {badge.status === 'active'
                    ? '🟢 Active'
                    : badge.status === 'paused'
                      ? '⏸ Paused'
                      : '🗄 Archived'}
                </Badge>
                {canWrite && badge.status !== 'archived' && (
                  <>
                    <div className="flex w-full gap-1.5">
                      <Button
                        size="xs"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setEditTarget(badge)
                          setEditorOpen(true)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setAwardTarget(badge)}
                      >
                        Award
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => setPauseTarget(badge)}>
                        {badge.status === 'active' ? 'Pause' : 'Resume'}
                      </Button>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                      onClick={() => setArchiveTarget(badge)}
                    >
                      Archive
                    </button>
                  </>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Award history */}
      <div className="mt-8">
        <h2 className="mb-2 text-lg font-semibold">Award History</h2>
        {historyQuery.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : historyQuery.isError ? (
          <RetryErrorState
            title="Unable to load award history"
            description="Retry?"
            onRetry={() => void historyQuery.refetch()}
            isRetrying={historyQuery.isFetching}
          />
        ) : historyQuery.data.items.length === 0 ? (
          <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            No badges have been awarded yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5">
                    Badge
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Student
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Source
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Awarded
                  </th>
                </tr>
              </thead>
              <tbody>
                {historyQuery.data.items.map((row) => (
                  <tr key={row.publicId} className="border-t">
                    <td className="px-4 py-2.5">
                      <span aria-hidden className="mr-1.5">
                        {row.badgeIcon ?? '🏅'}
                      </span>
                      {row.badgeName}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        to="/students/$studentId"
                        params={{ studentId: row.studentId }}
                        className="font-medium hover:underline"
                      >
                        {row.studentName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 capitalize text-muted-foreground">{row.source}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {new Date(row.awardedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StudentsBadgeEditorModal open={editorOpen} onOpenChange={setEditorOpen} badge={editTarget} />

      {/* Manual award with student picker + threshold confirmation */}
      {awardTarget && (
        <StudentsAwardDialog badge={awardTarget} onClose={() => setAwardTarget(null)} />
      )}

      {/* Archive confirmation: keeps historical awards visible (spec). */}
      <ConfirmDialog
        open={archiveTarget != null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title={`Archive ${archiveTarget?.name ?? 'this badge'}?`}
        body="Archiving stops all new awards. Existing awards stay visible on student profiles, and the badge name becomes reusable."
        confirmLabel="Archive Badge"
        destructive
        onConfirm={() => {
          if (archiveTarget == null) return
          setBadgeStatus.mutate({ badgePublicId: archiveTarget.publicId, status: 'archived' })
          setArchiveTarget(null)
        }}
      />

      {/* Pause/resume confirmation */}
      <ConfirmDialog
        open={pauseTarget != null}
        onOpenChange={(open) => !open && setPauseTarget(null)}
        title={
          pauseTarget?.status === 'active'
            ? `Pause ${pauseTarget.name}?`
            : `Resume ${pauseTarget?.name ?? 'badge'}?`
        }
        body={
          pauseTarget?.status === 'active'
            ? 'Pausing stops new awards without revoking existing ones.'
            : 'Resuming allows the trigger to award again on the next evaluation.'
        }
        confirmLabel={pauseTarget?.status === 'active' ? 'Pause Badge' : 'Resume Badge'}
        onConfirm={() => {
          if (pauseTarget == null) return
          setBadgeStatus.mutate({
            badgePublicId: pauseTarget.publicId,
            status: pauseTarget.status === 'active' ? 'paused' : 'active',
          })
          setPauseTarget(null)
        }}
      />
    </div>
  )
}

/** Badge editor (S-4.7 modal): identity + trigger + preview. */
function StudentsBadgeEditorModal({
  open,
  onOpenChange,
  badge,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  badge: BadgeCard | null
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('🏅')
  const [triggerKind, setTriggerKind] = useState<BadgeTrigger>('first_lesson')
  const [days, setDays] = useState('7')
  const [notifyStudent, setNotifyStudent] = useState(true)
  const [preview, setPreview] = useState<TriggerPreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const saveMutation = useSaveBadge()

  useEffect(() => {
    if (open) {
      setName(badge != null ? badge.name : '')
      setDescription(badge != null ? (badge.description ?? '') : '')
      setIcon(badge != null ? (badge.icon ?? '🏅') : '🏅')
      setTriggerKind(badge != null ? badge.triggerKind : 'first_lesson')
      setDays(String(badge != null ? (badge.triggerDays ?? 7) : 7))
      setNotifyStudent(true)
      setPreview(null)
    }
  }, [open, badge])

  const loadPreview = async () => {
    setPreviewLoading(true)
    try {
      const result = await previewBadgeTrigger({
        data:
          triggerKind === 'streak'
            ? { triggerKind, days: Math.max(1, Number(days) || 1) }
            : { triggerKind },
      })
      setPreview(result)
    } catch {
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const submit = () => {
    if (!name.trim()) return
    saveMutation.mutate(
      {
        badgePublicId: badge != null ? badge.publicId : undefined,
        name: name.trim(),
        description: description.trim() || null,
        icon: icon.trim() || null,
        trigger:
          triggerKind === 'streak'
            ? { triggerKind, days: Math.max(1, Number(days) || 1) }
            : { triggerKind },
        notifyStudent,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{badge ? 'Edit Badge' : 'Create Badge'}</DialogTitle>
          <DialogDescription>
            One trigger per badge — combine behaviors by awarding multiple badges.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <div className="grid gap-2">
              <Label htmlFor="badge-icon">Icon</Label>
              <Input
                id="badge-icon"
                value={icon}
                onChange={(event) => setIcon(event.target.value)}
                maxLength={4}
                className="text-center text-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="badge-name">
                Name{' '}
                <span aria-hidden className="text-destructive">
                  *
                </span>
              </Label>
              <Input
                id="badge-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setPreview(null)
                }}
                placeholder="First Steps"
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="badge-description">Description</Label>
            <Textarea
              id="badge-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Completed your first lesson — the journey begins!"
              rows={2}
            />
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Trigger</legend>
            {(
              [
                ['first_lesson', 'First lesson completed'],
                ['streak', 'Streak ≥ days'],
                ['quiz_perfect', 'Quiz score = 100%'],
                ['course_completed', 'Course completed'],
                ['manual', 'Manual award'],
              ] as Array<[BadgeTrigger, string]>
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="badge-trigger"
                  value={value}
                  checked={triggerKind === value}
                  onChange={() => {
                    setTriggerKind(value)
                    setPreview(null)
                  }}
                  className="accent-[var(--primary)]"
                />
                {label}
                {value === 'streak' && triggerKind === 'streak' && (
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={days}
                    onChange={(event) => {
                      setDays(event.target.value)
                      setPreview(null)
                    }}
                    aria-label="Streak days"
                    className="ml-1 h-8 w-20"
                  />
                )}
              </label>
            ))}
          </fieldset>

          {canWritePreview(triggerKind) && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <button
                type="button"
                className="font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => void loadPreview()}
                disabled={previewLoading}
              >
                {previewLoading ? 'Counting…' : 'Preview matching students'}
              </button>
              {preview && (
                <span className="ml-2">{triggerPreviewMessage(preview.matchedCount)}</span>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={notifyStudent}
              onChange={(event) => setNotifyStudent(event.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            Notify the student (in-app)
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || saveMutation.isPending}>
              {saveMutation.isPending && (
                <Loader2Icon aria-hidden className="size-4 animate-spin" />
              )}
              {badge ? 'Save Changes' : 'Create Badge'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function canWritePreview(triggerKind: BadgeTrigger): boolean {
  return triggerKind !== 'manual'
}

/** Manual award picker (student search + optional note). */
function StudentsAwardDialog({ badge, onClose }: { badge: BadgeCard; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const candidatesQuery = useQuery({
    ...cohortCandidatesQueryOptions(search),
    enabled: true,
    staleTime: 30_000,
  })
  const awardMutation = useAwardBadge()

  const needsConfirm = selected.size > MANUAL_AWARD_CONFIRM_THRESHOLD

  const submit = () => {
    awardMutation.mutate(
      {
        badgePublicId: badge.publicId,
        studentIds: Array.from(selected),
        note: note.trim() || undefined,
      },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Award <span aria-hidden>{badge.icon ?? '🏅'}</span> {badge.name}
            </DialogTitle>
            <DialogDescription>
              Search students and select the recipients. Batch awards above{' '}
              {MANUAL_AWARD_CONFIRM_THRESHOLD} students ask for confirmation.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <SearchIcon
              aria-hidden
              className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search students…"
              aria-label="Search students"
              className="pl-8"
              autoFocus
            />
          </div>
          <ul
            className="min-h-40 flex-1 overflow-y-auto rounded-md border"
            role="listbox"
            aria-label="Students"
          >
            {(candidatesQuery.data ?? []).length === 0 ? (
              <li className="p-3 text-sm text-muted-foreground" role="status">
                {search ? 'No students match.' : 'Start typing to search students.'}
              </li>
            ) : (
              (candidatesQuery.data ?? []).map((student) => (
                <li key={student.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected.has(student.id)}
                    onClick={() =>
                      setSelected((prev) => {
                        const next = new Set(prev)
                        if (next.has(student.id)) next.delete(student.id)
                        else next.add(student.id)
                        return next
                      })
                    }
                    className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{student.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {student.email}
                      </span>
                    </span>
                    {selected.has(student.id) && (
                      <span className="text-xs font-medium text-primary">Selected</span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="grid gap-2">
            <Label htmlFor="award-note">Note (optional)</Label>
            <Input
              id="award-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Context shown in the award history"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={selected.size === 0 || awardMutation.isPending}
              onClick={() => (needsConfirm ? setConfirmOpen(true) : submit())}
            >
              {awardMutation.isPending && (
                <Loader2Icon aria-hidden className="size-4 animate-spin" />
              )}
              Award {selected.size || ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Award to ${selected.size} students?`}
        body={`${badge.name} will be granted to every selected student and each is notified.`}
        confirmLabel="Award Badges"
        onConfirm={() => {
          setConfirmOpen(false)
          submit()
        }}
      />
    </>
  )
}
