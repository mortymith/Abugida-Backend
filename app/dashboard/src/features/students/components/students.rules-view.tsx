import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CopyIcon, Loader2Icon, PlayIcon, PlusIcon, TrashIcon, WorkflowIcon } from 'lucide-react'
import { useRole } from '#/features/auth'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
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
import {
  enrollableCoursesQueryOptions,
  ruleRunsQueryOptions,
  rulesQueryOptions,
  studentsReferenceQueryOptions,
} from '../hooks/students.queries'
import {
  useDeleteRule,
  useDuplicateRule,
  useRunRule,
  useSaveRule,
  useSetRuleStatus,
} from '../hooks/students.mutations'
import { dryRunRule } from '../server/all'
import type { DryRunResult, EnrollmentRuleRow } from '../students.types'
import type { RuleTriggerInput } from '../schemas/students.schema'

/**
 * S-4.8 Automated Enrollment Rules: rules table with trigger → target,
 * WHEN/AND/THEN builder, dry-run preview ("Would enroll N students"), run
 * with run log, and draft/active/paused lifecycle.
 */
export function StudentsRulesView() {
  const role = useRole()
  const canWrite = role === 'admin' || role === 'editor'

  const rulesQuery = useQuery(rulesQueryOptions())
  const deleteMutation = useDeleteRule()
  const duplicateMutation = useDuplicateRule()
  const setStatus = useSetRuleStatus()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<EnrollmentRuleRow | null>(null)
  const [runTarget, setRunTarget] = useState<EnrollmentRuleRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EnrollmentRuleRow | null>(null)
  const [runsTarget, setRunsTarget] = useState<EnrollmentRuleRow | null>(null)

  const items = rulesQuery.data?.items ?? []

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Automated Enrollment Rules</h1>
          <p className="text-sm text-muted-foreground">
            Auto-enroll students based on completions, tags, cohorts, or new accounts.
          </p>
        </div>
        {canWrite && (
          <Button
            onClick={() => {
              setEditTarget(null)
              setEditorOpen(true)
            }}
          >
            <PlusIcon aria-hidden /> New Rule
          </Button>
        )}
      </div>

      {rulesQuery.isPending ? (
        <Skeleton className="h-56 w-full" role="status" aria-label="Loading rules" />
      ) : rulesQuery.isError ? (
        <RetryErrorState
          title="Unable to load rules"
          description="Retry?"
          onRetry={() => void rulesQuery.refetch()}
          isRetrying={rulesQuery.isFetching}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<WorkflowIcon className="size-10 text-muted-foreground" />}
          variant="standard"
          title="No enrollment rules yet"
          description="Create a rule to replace repetitive manual enrollment with auditable automation."
          action={
            canWrite ? (
              <Button
                size="sm"
                onClick={() => {
                  setEditTarget(null)
                  setEditorOpen(true)
                }}
              >
                New Rule
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3">
          {items.map((rule) => (
            <Card key={rule.publicId}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{rule.name}</p>
                    <Badge
                      variant="secondary"
                      className={
                        rule.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : rule.status === 'paused'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-muted text-muted-foreground'
                      }
                    >
                      {rule.status === 'active'
                        ? '🟢 On'
                        : rule.status === 'paused'
                          ? '⏸ Paused'
                          : 'Draft'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {rule.triggerLabel} →{' '}
                    <span className="font-medium text-foreground">{rule.targetCourseTitle}</span>
                    {rule.minQuizAvgPercent != null
                      ? ` · AND quiz avg ≥ ${rule.minQuizAvgPercent}%`
                      : ''}
                    {rule.sendWelcomeEmail ? ' · welcome message on enroll' : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {rule.lastRunSummary
                      ? `Last run: ${rule.lastRunSummary.enrolled} enrolled · ${rule.lastRunSummary.skipped} already in`
                      : 'Never run'}
                  </p>
                </div>
                {canWrite && (
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="xs" variant="outline" onClick={() => setRunTarget(rule)}>
                      <PlayIcon aria-hidden className="size-3.5" /> Run
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        setStatus.mutate({
                          rulePublicId: rule.publicId,
                          status: rule.status === 'active' ? 'paused' : 'active',
                        })
                      }
                    >
                      {rule.status === 'active' ? 'Pause' : 'Activate'}
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        setEditTarget(rule)
                        setEditorOpen(true)
                      }}
                    >
                      Edit
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => setRunsTarget(rule)}>
                      Log
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => duplicateMutation.mutate({ rulePublicId: rule.publicId })}
                    >
                      <CopyIcon aria-hidden className="size-3.5" />
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(rule)}
                    >
                      <TrashIcon aria-hidden className="size-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <StudentsRuleEditorModal open={editorOpen} onOpenChange={setEditorOpen} rule={editTarget} />

      {runTarget && <StudentsRuleRunDialog rule={runTarget} onClose={() => setRunTarget(null)} />}

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? 'this rule'}?`}
        body="Past enrollments are never reversed. The run log is deleted with the rule."
        confirmLabel="Delete Rule"
        destructive
        onConfirm={() => {
          if (deleteTarget == null) return
          deleteMutation.mutate({ rulePublicId: deleteTarget.publicId })
          setDeleteTarget(null)
        }}
      />

      {runsTarget && (
        <Dialog open onOpenChange={(open) => !open && setRunsTarget(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Run Log — {runsTarget.name}</DialogTitle>
              <DialogDescription>Per run: matched, enrolled, skipped, failed.</DialogDescription>
            </DialogHeader>
            <RuleRunsList rulePublicId={runsTarget.publicId} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function RuleRunsList({ rulePublicId }: { rulePublicId: string }) {
  const runsQuery = useQuery(ruleRunsQueryOptions({ rulePublicId }))
  if (runsQuery.isPending) {
    return <Skeleton className="h-40 w-full" role="status" />
  }
  if (runsQuery.isError) {
    return (
      <RetryErrorState
        title="Unable to load the run log"
        description="Retry?"
        onRetry={() => void runsQuery.refetch()}
        isRetrying={runsQuery.isFetching}
      />
    )
  }
  const runs = runsQuery.data.items
  if (runs.length === 0) {
    return (
      <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">
        This rule has not been run yet.
      </p>
    )
  }
  return (
    <ol className="grid max-h-80 gap-2 overflow-y-auto">
      {runs.map((run) => (
        <li key={run.publicId} className="rounded-md border px-3 py-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium capitalize">{run.runKind.replace('_', ' ')}</span>
            <time className="text-xs text-muted-foreground">
              {new Date(run.ranAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </time>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {run.matched} matched · {run.enrolled} enrolled · {run.skipped} skipped · {run.failed}{' '}
            failed
          </p>
        </li>
      ))}
    </ol>
  )
}

/** Rule builder (WHEN / AND / THEN) with dry-run preview. */
function StudentsRuleEditorModal({
  open,
  onOpenChange,
  rule,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: EnrollmentRuleRow | null
}) {
  const [name, setName] = useState('')
  const [triggerKind, setTriggerKind] =
    useState<RuleTriggerInput['triggerKind']>('course_completed')
  const [triggerCourseId, setTriggerCourseId] = useState('')
  const [triggerTag, setTriggerTag] = useState('')
  const [triggerCohortId, setTriggerCohortId] = useState('')
  const [minQuizAvg, setMinQuizAvg] = useState('')
  const [targetCoursePublicId, setTargetCoursePublicId] = useState('')
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(false)
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null)
  const [dryRunLoading, setDryRunLoading] = useState(false)
  const [dryRunError, setDryRunError] = useState(false)

  const coursesQuery = useQuery({ ...enrollableCoursesQueryOptions(), enabled: open })
  const referenceQuery = useQuery({ ...studentsReferenceQueryOptions(), enabled: open })
  const saveMutation = useSaveRule()

  useEffect(() => {
    if (open) {
      setName(rule?.name ?? '')
      setTriggerKind(rule?.triggerKind ?? 'course_completed')
      setTriggerCourseId(rule?.triggerCoursePublicId ?? '')
      setTriggerTag(rule?.triggerTag ?? '')
      setTriggerCohortId(rule?.triggerCohortPublicId ?? '')
      setMinQuizAvg(rule?.minQuizAvgPercent != null ? String(rule.minQuizAvgPercent) : '')
      setTargetCoursePublicId(rule?.targetCoursePublicId ?? '')
      setSendWelcomeEmail(rule?.sendWelcomeEmail ?? false)
      setDryRun(null)
      setDryRunError(false)
    }
  }, [open, rule])

  const courses = coursesQuery.data ?? []
  const selectedTarget = courses.find((course) => course.publicId === targetCoursePublicId)

  const buildTrigger = (): RuleTriggerInput =>
    triggerKind === 'course_completed'
      ? { triggerKind, coursePublicId: triggerCourseId }
      : triggerKind === 'tag_added'
        ? { triggerKind, tag: triggerTag.trim() }
        : triggerKind === 'cohort_assigned'
          ? { triggerKind, cohortPublicId: triggerCohortId }
          : { triggerKind }

  const buildDraft = () => ({
    draft: {
      name: name.trim() || 'Untitled rule',
      trigger: buildTrigger(),
      targetCoursePublicId,
      minQuizAvgPercent: minQuizAvg ? Math.min(100, Math.max(1, Number(minQuizAvg))) : null,
      sendWelcomeEmail,
    },
  })

  const runDry = async () => {
    setDryRunLoading(true)
    setDryRunError(false)
    try {
      const result = await dryRunRule({ data: buildDraft() })
      setDryRun(result)
    } catch {
      setDryRun(null)
      setDryRunError(true)
    } finally {
      setDryRunLoading(false)
    }
  }

  const submit = () => {
    saveMutation.mutate(
      {
        rulePublicId: rule?.publicId,
        name: name.trim(),
        trigger: buildTrigger(),
        targetCoursePublicId,
        minQuizAvgPercent: minQuizAvg ? Math.min(100, Math.max(1, Number(minQuizAvg))) : null,
        sendWelcomeEmail,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  const selfLoop =
    triggerKind === 'course_completed' &&
    triggerCourseId === targetCoursePublicId &&
    triggerCourseId !== ''

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{rule ? 'Edit Rule' : 'New Rule'}</DialogTitle>
            <DialogDescription>
              Rules create enrollments exactly as manual enrollment does — fully auditable.
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
              <Label htmlFor="rule-name">
                Rule name{' '}
                <span aria-hidden className="text-destructive">
                  *
                </span>
              </Label>
              <Input
                id="rule-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="TOEFL→IELTS path"
                required
              />
            </div>

            {/* WHEN */}
            <fieldset className="rounded-md border p-3">
              <legend className="px-1 text-sm font-semibold">WHEN</legend>
              <div className="grid gap-2">
                <select
                  aria-label="Trigger"
                  value={triggerKind}
                  onChange={(event) => {
                    setTriggerKind(event.target.value as RuleTriggerInput['triggerKind'])
                    setDryRun(null)
                  }}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="course_completed">student completes a course</option>
                  <option value="tag_added">tag added</option>
                  <option value="cohort_assigned">assigned to cohort</option>
                  <option value="account_created">account created</option>
                </select>
                {triggerKind === 'course_completed' && (
                  <select
                    aria-label="Trigger course"
                    value={triggerCourseId}
                    onChange={(event) => {
                      setTriggerCourseId(event.target.value)
                      setDryRun(null)
                    }}
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  >
                    <option value="">Select the completed course…</option>
                    {courses.map((course) => (
                      <option key={course.publicId} value={course.publicId}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                )}
                {triggerKind === 'tag_added' && (
                  <Input
                    value={triggerTag}
                    onChange={(event) => {
                      setTriggerTag(event.target.value)
                      setDryRun(null)
                    }}
                    placeholder="acme-2026"
                    aria-label="Trigger tag"
                    list="student-tag-options"
                    required
                  />
                )}
                {triggerKind === 'cohort_assigned' && (
                  <select
                    aria-label="Trigger cohort"
                    value={triggerCohortId}
                    onChange={(event) => {
                      setTriggerCohortId(event.target.value)
                      setDryRun(null)
                    }}
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  >
                    <option value="">Select the cohort…</option>
                    {(referenceQuery.data?.cohorts ?? []).map((cohort) => (
                      <option key={cohort.publicId} value={cohort.publicId}>
                        {cohort.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </fieldset>

            {/* AND */}
            <fieldset className="rounded-md border p-3">
              <legend className="px-1 text-sm font-semibold">AND (optional)</legend>
              <label className="flex items-center gap-2 text-sm">
                Quiz average ≥
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={minQuizAvg}
                  onChange={(event) => {
                    setMinQuizAvg(event.target.value)
                    setDryRun(null)
                  }}
                  placeholder="—"
                  aria-label="Minimum quiz average percent"
                  className="h-8 w-20"
                />
                % in the trigger course
              </label>
            </fieldset>

            {/* THEN */}
            <fieldset className="rounded-md border p-3">
              <legend className="px-1 text-sm font-semibold">THEN</legend>
              <div className="grid gap-2">
                <select
                  aria-label="Target course"
                  value={targetCoursePublicId}
                  onChange={(event) => {
                    setTargetCoursePublicId(event.target.value)
                    setDryRun(null)
                  }}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                >
                  <option value="">Enroll in…</option>
                  {courses.map((course) => (
                    <option key={course.publicId} value={course.publicId}>
                      {course.title}
                      {course.isFree ? '' : ` (${course.priceLabel ?? 'paid'})`}
                    </option>
                  ))}
                </select>
                {selectedTarget != null && !selectedTarget.isFree && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    This grants paid access at no charge — a confirmation is required on run.
                  </p>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={sendWelcomeEmail}
                    onChange={(event) => setSendWelcomeEmail(event.target.checked)}
                    className="size-4 accent-[var(--primary)]"
                  />
                  Send welcome message on enroll
                </label>
              </div>
            </fieldset>

            {selfLoop && (
              <p role="alert" className="text-sm text-destructive">
                A rule cannot target its own trigger course.
              </p>
            )}
            {dryRunError && (
              <p role="alert" className="text-sm text-destructive">
                Dry run failed — check the rule and retry.
              </p>
            )}

            {/* Dry run preview */}
            {dryRun && (
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-sm font-medium">
                  Would enroll {dryRun.willEnroll} student{dryRun.willEnroll === 1 ? '' : 's'}
                  {dryRun.willSkip > 0 && ` · ${dryRun.willSkip} will be skipped`}
                </p>
                <ul className="mt-1.5 grid max-h-32 gap-0.5 overflow-y-auto text-xs text-muted-foreground">
                  {dryRun.items.slice(0, 20).map((item) => (
                    <li key={item.studentId}>
                      {item.outcome === 'will_enroll' ? '✓' : '↷'} {item.studentName} —{' '}
                      {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <datalist id="student-tag-options">
              {(referenceQuery.data?.tags ?? []).map((tag) => (
                <option key={tag.tag} value={tag.tag} />
              ))}
            </datalist>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={!name.trim() || !targetCoursePublicId || dryRunLoading || selfLoop}
                onClick={() => void runDry()}
              >
                {dryRunLoading && <Loader2Icon aria-hidden className="size-4 animate-spin" />}
                Dry Run
              </Button>
              <Button
                type="submit"
                disabled={
                  !name.trim() ||
                  !targetCoursePublicId ||
                  selfLoop ||
                  saveMutation.isPending ||
                  (triggerKind === 'course_completed' && !triggerCourseId) ||
                  (triggerKind === 'tag_added' && !triggerTag.trim()) ||
                  (triggerKind === 'cohort_assigned' && !triggerCohortId)
                }
              >
                {saveMutation.isPending && (
                  <Loader2Icon aria-hidden className="size-4 animate-spin" />
                )}
                Save Draft
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Run-now dialog: confirmation (paid target disclosed) then runs. */
function StudentsRuleRunDialog({
  rule,
  onClose,
}: {
  rule: EnrollmentRuleRow
  onClose: () => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(true)
  const runMutation = useRunRule()
  const coursesQuery = useQuery(enrollableCoursesQueryOptions())
  const target = (coursesQuery.data ?? []).find(
    (course) => course.publicId === rule.targetCoursePublicId,
  )
  const isPaid = target != null && !target.isFree

  return (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`Run ${rule.name}?`}
      body={`Matching students will be enrolled into ${rule.targetCourseTitle}${rule.minQuizAvgPercent != null ? ` (quiz avg ≥ ${rule.minQuizAvgPercent}%)` : ''}. Students already enrolled are skipped.${isPaid ? ' This will grant paid access at no charge.' : ''}`}
      confirmLabel="Run Rule"
      destructive={isPaid}
      onConfirm={() => {
        runMutation.mutate({ rulePublicId: rule.publicId }, { onSuccess: () => onClose() })
        setConfirmOpen(false)
      }}
    />
  )
}
