import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Alert02Icon, CheckmarkCircle02Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { toast } from '#/components/common/toast'
import { Button } from '#/components/ui/button'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import { StatusPill } from './courses.status-pill'
import { useCourseLifecycleMutations, usePublishReadiness } from '../hooks/courses.workspace-hooks'
import { courseDetailsQueryOptions } from '../hooks/courses.queries'
import { useQuery } from '@tanstack/react-query'
import { canPublish, firstBlockingCheck, READINESS_CHECK_LABELS } from '../courses.readiness'
import type { ReadinessCheck, ReadinessCheckId, ReadinessResult } from '../courses.readiness'
import { COURSE_LIFECYCLE_LABELS, deriveCourseLifecycleState } from '../courses.workspace'
import type { CourseLifecycleState } from '../courses.workspace'

/**
 * S-2.22 Publish Readiness & Course Review.
 *
 * "Can this ship, who signs it off, and what happens to students when it does."
 * The checklist is **read-only**: `getPublishReadiness` evaluates server-side
 * and the client list is a convenience, never the gate. Every row carries a
 * **Fix** deep link into the exact tab, because "a checklist the author cannot
 * act on is a report, not a gate."
 *
 * The blocking count is `ReadinessResult.blockingFailures` — the same value the
 * Overview banner and the Course health card quote, so the three surfaces cannot
 * disagree about how many checks remain.
 *
 * Viewer sees the checklist and **no action control at all** (case 1 of the
 * three-case rule: absent, not disabled).
 */
export function PublishReadinessPanel({
  coursePublicId,
  role,
}: {
  coursePublicId: string
  role: string
}) {
  const readiness = usePublishReadiness(coursePublicId)
  const details = useQuery(courseDetailsQueryOptions(coursePublicId))
  const mutations = useCourseLifecycleMutations(coursePublicId)
  const [note, setNote] = useState('')
  const [decisionComment, setDecisionComment] = useState('')

  if (readiness.isPending || details.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Spinner className="mx-auto my-8" />
        <p className="text-center text-sm text-muted-foreground">Evaluating readiness…</p>
      </div>
    )
  }
  if (readiness.isError) {
    return (
      <RetryErrorState
        onRetry={() => void readiness.refetch()}
        description="We couldn't evaluate readiness — nothing was changed."
      />
    )
  }
  if (details.isError) {
    return <RetryErrorState onRetry={() => void details.refetch()} />
  }

  const result = readiness.data
  const course = details.data
  const state = deriveCourseLifecycleState({
    status: course.status,
    approvedAt: course.approvedAt,
  })
  const isViewer = role === 'viewer'
  const cta = firstBlockingCheck(result)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl font-bold">Publish Readiness</h2>
        <StatusPill tone={state} />
        <span className="text-xs text-muted-foreground">v{course.version}</span>
        <p className="w-full text-sm text-muted-foreground">
          {result.passCount} of {result.checks.length} checks pass
          {result.blockingFailures > 0 ? ` — ${result.blockingFailures} remain` : ''}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <ol className="flex flex-col gap-2" aria-label="Readiness checks">
          {result.checks.map((check) => (
            <ReadinessRow key={check.id} check={check} coursePublicId={coursePublicId} />
          ))}
        </ol>

        <aside className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <h3 className="font-semibold">Lifecycle</h3>
          <p className="text-sm text-muted-foreground">
            Currently {COURSE_LIFECYCLE_LABELS[state].toLowerCase()}.
          </p>

          {/*
              Blocking failures state the reason inline — never a disabled button
              with no explanation.
          */}
          {!canPublish(result) && cta ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
              {result.blockingFailures} blocking check
              {result.blockingFailures === 1 ? '' : 's'} remaining — {cta.id} first.
            </p>
          ) : null}

          {/*
              Viewer is case 1: every action is absent, not disabled. The action
              set is a function of the *state* alone, so one component covers
              every case — including Archived (case 3), where only Restore
              remains and it is offered to every role that reached the panel.
          */}
          {isViewer ? (
            <p className="text-xs text-muted-foreground">
              You have read-only access to this checklist.
            </p>
          ) : (
            <LifecycleActions
              state={state}
              coursePublicId={coursePublicId}
              role={role}
              isReviewer={role === 'admin' || role === 'reviewer'}
              requiresApproval={course.requiresApproval}
              result={result}
              note={note}
              setNote={setNote}
              decisionComment={decisionComment}
              setDecisionComment={setDecisionComment}
              mutations={mutations}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

/**
 * The lifecycle action column.
 *
 * Split out of the panel because the action set is a function of the *state*,
 * not of the panel's data — keeping it in its own component stops the archived
 * branch from being folded into a `canAct` guard that makes it unreachable to
 * the type checker (and, worse, at runtime).
 */
function LifecycleActions({
  state,
  result,
  note,
  setNote,
  decisionComment,
  setDecisionComment,
  isReviewer,
  requiresApproval,
  mutations,
}: {
  state: CourseLifecycleState
  coursePublicId: string
  role: string
  isReviewer: boolean
  requiresApproval: boolean
  result: ReadinessResult
  note: string
  setNote: Dispatch<SetStateAction<string>>
  decisionComment: string
  setDecisionComment: Dispatch<SetStateAction<string>>
  mutations: ReturnType<typeof useCourseLifecycleMutations>
}) {
  const run = (promise: Promise<unknown>, message: string, failure: string) => {
    void promise
      .then(() => toast.success(message))
      .catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : failure))
  }

  if (state === 'archived') {
    // Case 3: the whole surface is locked. Only Restore remains actionable.
    return (
      <Button
        size="sm"
        onClick={() =>
          run(mutations.restore.mutateAsync(), 'Course restored to Draft.', 'Restore failed.')
        }
      >
        Restore
      </Button>
    )
  }

  if (state === 'published') {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          run(
            mutations.unpublish.mutateAsync(),
            'Unpublished. Enrolled students keep access for the grace period.',
            'Unpublish failed.',
          )
        }
      >
        Unpublish
      </Button>
    )
  }

  if (state === 'approved') {
    return (
      <Button
        size="sm"
        disabled={!canPublish(result)}
        onClick={() => run(mutations.publish.mutateAsync(), 'Course published.', 'Publish failed.')}
      >
        Publish now
      </Button>
    )
  }

  if (state === 'in_review') {
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            run(mutations.withdraw.mutateAsync(), 'Submission withdrawn.', 'Withdrawal failed.')
          }
        >
          Withdraw
        </Button>
        {isReviewer ? (
          <>
            <label className="text-xs text-muted-foreground" htmlFor="decision-comment">
              Decision comment (required for changes/rejection)
            </label>
            <Textarea
              id="decision-comment"
              value={decisionComment}
              onChange={(event) => setDecisionComment(event.target.value)}
              placeholder="Why, and what to change."
            />
            <Button
              size="sm"
              onClick={() =>
                run(
                  mutations.decide.mutateAsync({ decision: 'approve', comment: decisionComment }),
                  'Approved.',
                  'Decision failed.',
                )
              }
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={decisionComment.trim().length === 0}
              onClick={() =>
                run(
                  mutations.decide.mutateAsync({
                    decision: 'request_changes',
                    comment: decisionComment.trim(),
                  }),
                  'Changes requested.',
                  'Decision failed.',
                )
              }
            >
              Request changes
            </Button>
          </>
        ) : null}
      </>
    )
  }

  // Draft: an Editor on a gated course submits; an ungated course publishes.
  if (requiresApproval) {
    return (
      <>
        <label className="text-xs text-muted-foreground" htmlFor="submission-note">
          Submission note (optional)
        </label>
        <Textarea
          id="submission-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What changed since the last review?"
        />
        <Button
          size="sm"
          disabled={!canPublish(result)}
          onClick={() =>
            run(
              mutations.submit.mutateAsync(note.trim() || null),
              'Submitted for review.',
              'Submission failed.',
            )
          }
        >
          Submit for review
        </Button>
      </>
    )
  }

  return (
    <Button
      size="sm"
      disabled={!canPublish(result)}
      onClick={() => run(mutations.publish.mutateAsync(), 'Course published.', 'Publish failed.')}
    >
      Publish now
    </Button>
  )
}

/**
 * Where each check sends the author. The spec's Fix-location column, expressed
 * as a tab deep link so a row the author cannot act on never ships.
 */
const CHECK_FIX_TARGETS: Partial<Record<ReadinessCheckId, CourseWorkspaceTabTarget>> = {
  'RC-1': { tab: 'settings', label: 'Details' },
  'RC-2': { tab: 'settings', label: 'Details' },
  'RC-3': { tab: 'curriculum', label: 'Curriculum' },
  'RC-4a': { tab: 'curriculum', label: 'Item pane' },
  'RC-4b': { tab: 'curriculum', label: 'Quiz builder' },
  'RC-4c': { tab: 'curriculum', label: 'Assignment builder' },
  'RC-5': { tab: 'curriculum', label: 'Item overview' },
  'RC-6': { tab: 'settings', label: 'Pricing' },
  'RC-7': { tab: 'settings', label: 'Completion' },
  'RC-8': { tab: 'students', label: 'Review queue' },
}

interface CourseWorkspaceTabTarget {
  tab: 'overview' | 'curriculum' | 'students' | 'analytics' | 'settings'
  label: string
}

function ReadinessRow({
  check,
  coursePublicId,
}: {
  check: ReadinessCheck
  coursePublicId: string
}) {
  const target = CHECK_FIX_TARGETS[check.id]
  // Advisory checks report but never block: RC-7 must not stop a course
  // shipping, so its icon is informational rather than a failure.
  const icon = check.passed ? CheckmarkCircle02Icon : check.blocking ? Cancel01Icon : Alert02Icon
  const tone = check.passed
    ? 'text-green-600 dark:text-green-400'
    : check.blocking
      ? 'text-red-600 dark:text-red-400'
      : 'text-amber-600 dark:text-amber-400'

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
      <HugeiconsIcon icon={icon} className={`size-4 shrink-0 ${tone}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 text-sm">
        <span className="font-medium">{check.id}</span>{' '}
        <span className="text-muted-foreground">{READINESS_CHECK_LABELS[check.id]}</span>
        {check.detail ? (
          <span className="block text-xs text-muted-foreground">{check.detail}</span>
        ) : null}
        {!check.passed && !check.blocking ? (
          <span className="block text-xs text-muted-foreground">Advisory — does not block</span>
        ) : null}
      </span>
      {!check.passed && target ? (
        <Link
          to="/courses/$courseId"
          params={{ courseId: coursePublicId }}
          search={{ tab: target.tab }}
          className="text-xs text-violet-600 hover:underline"
        >
          Fix → {target.label}
        </Link>
      ) : null}
    </li>
  )
}
