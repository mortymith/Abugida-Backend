import { useId, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, MoreHorizontalIcon, ViewIcon } from '@hugeicons/core-free-icons'
import { toast } from '#/components/common/toast'
import { Button, buttonVariants } from '#/components/ui/button'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { StatusPill } from './courses.status-pill'
import { CourseTitleEditor } from './courses.title-editor'
import { courseStudentsQueryOptionsFn } from '../hooks/courses.queries'
import {
  readinessItemsNeedingContent,
  useCourseLifecycleMutations,
  usePublishReadiness,
} from '../hooks/courses.workspace-hooks'
import {
  COUNTED_WORKSPACE_TABS,
  COURSE_LIFECYCLE_LABELS,
  COURSE_LIFECYCLE_ORDER,
  courseLifecycleCta,
  deriveCourseLifecycleState,
  parseCourseWorkspaceSearch,
  resolveWorkspaceTab,
  WORKSPACE_TAB_LABELS,
  workspaceTabsForRole,
} from '../courses.workspace'
import type {
  CourseLifecycleAction,
  CourseLifecycleState,
  CourseWorkspaceTab,
} from '../courses.workspace'

/**
 * The Course Workspace shell (spec 04 § Workspace Anatomy, S-2.6).
 *
 * Three regions, and only three: a sticky **identity header** (title, status
 * pill, lifecycle stepper, lifecycle CTA, `⋯` menu), a **role-filtered nav**,
 * and the tab content the caller renders. Nothing here knows what a tab
 * contains — the shell is the part every tab shares, which is exactly why the
 * tab list and the lifecycle vocabulary live in `courses.workspace.ts` rather
 * than in this file.
 *
 * The role filter is `workspaceTabsForRole`, not a local `role === 'admin'`
 * check: Support gets the Students tab **only**, and the other four are absent
 * rather than disabled (case 1 of the three-case permission rule). A deep link
 * to a tab the role cannot open resolves through `resolveWorkspaceTab` onto a
 * destination their nav actually shows, so it never renders an empty shell.
 */

interface CourseWorkspaceShellProps {
  coursePublicId: string
  role: string
  previewBaseUrl?: string
  /** Opens the S-2.22 readiness panel, owned by the workspace tab host. */
  onOpenReadiness?: () => void
  /** Rendered under the nav. The shell owns the chrome, not the tabs. */
  children: React.ReactNode
}

export function CourseWorkspaceShell({
  coursePublicId,
  role,
  previewBaseUrl,
  onOpenReadiness,
  children,
}: CourseWorkspaceShellProps) {
  const tabs = workspaceTabsForRole(role)
  const activeTab = resolveWorkspaceTab(role, useActiveWorkspaceTab())
  const lifecycle = useCourseLifecycle(coursePublicId)

  return (
    <div className="flex flex-col gap-4">
      <CourseIdentityHeader
        coursePublicId={coursePublicId}
        role={role}
        previewBaseUrl={previewBaseUrl}
        lifecycle={lifecycle}
      />
      <WorkspaceNav coursePublicId={coursePublicId} role={role} tabs={tabs} activeTab={activeTab} />
      <ReadinessBanner
        coursePublicId={coursePublicId}
        role={role}
        itemsNeedingContent={lifecycle.itemsNeedingContent}
        onOpenReadiness={onOpenReadiness}
      />
      {children}
    </div>
  )
}

/**
 * The active tab, read from the route the shell is mounted under.
 *
 * `parseCourseWorkspaceSearch` in `courses.workspace.ts` is the single validator
 * — the shell does not re-derive what a legal tab is, so the nav and the URL can
 * never disagree about the vocabulary.
 */
function useActiveWorkspaceTab(): CourseWorkspaceTab {
  const search = useSearch({ strict: false })
  return parseCourseWorkspaceSearch(search).tab
}

// ── Identity header ────────────────────────────────────────────────────────

interface CourseLifecycleView {
  state: CourseLifecycleState
  title: string
  version: number
  requiresApproval: boolean
  approvedAt: string | null
  publishedAt: string | null
  itemsNeedingContent: number
  isPending: boolean
  isError: boolean
  refetch: () => void
}

function useCourseLifecycle(coursePublicId: string): CourseLifecycleView {
  const details = useQuery({
    queryKey: ['courses', 'details', coursePublicId],
    queryFn: async () => {
      const { getCourseDetails } = await import('../server/all')
      return getCourseDetails({ data: { coursePublicId } })
    },
    staleTime: 30_000,
  })
  const readiness = usePublishReadiness(coursePublicId)
  const course = details.data

  return {
    state: course
      ? deriveCourseLifecycleState({ status: course.status, approvedAt: course.approvedAt })
      : 'draft',
    title: course?.title ?? coursePublicId,
    version: course?.version ?? 0,
    requiresApproval: course?.requiresApproval ?? false,
    approvedAt: course?.approvedAt ?? null,
    publishedAt: course?.publishedAt ?? null,
    itemsNeedingContent: readinessItemsNeedingContent(readiness.data),
    isPending: details.isPending,
    isError: details.isError,
    refetch: () => {
      void details.refetch()
      void readiness.refetch()
    },
  }
}

function CourseIdentityHeader({
  coursePublicId,
  role,
  previewBaseUrl,
  lifecycle,
}: {
  coursePublicId: string
  role: string
  previewBaseUrl?: string
  lifecycle: CourseLifecycleView
}) {
  const navigate = useNavigate()
  const mutations = useCourseLifecycleMutations(coursePublicId)
  const [confirming, setConfirming] = useState<'archive' | 'unpublish' | null>(null)
  const isAuthoring = role === 'admin' || role === 'editor'
  const cta = courseLifecycleCta(lifecycle.state, lifecycle.requiresApproval)

  if (lifecycle.isError) {
    return (
      <RetryErrorState
        onRetry={lifecycle.refetch}
        description="We couldn't load this course — your work is safe."
      />
    )
  }

  /**
   * Run the lifecycle action the CTA names. Each mutation is a distinct
   * `useMutation`, so the union is narrowed here rather than coerced — the
   * `submit`/`withdraw`/`decide` shapes take arguments the others do not, and a
   * shared `mutate(undefined)` would silently mistype them.
   */
  const runLifecycle = (action: CourseLifecycleAction) => {
    const onSuccess = () => toast.success('Course updated.')
    const onError = (cause: unknown) =>
      toast.error(cause instanceof Error ? cause.message : 'Action failed.')
    switch (action) {
      case 'submit':
        mutations.submit.mutate(null, { onSuccess, onError })
        break
      case 'withdraw':
        mutations.withdraw.mutate(undefined, { onSuccess, onError })
        break
      case 'publish':
        mutations.publish.mutate(undefined, { onSuccess, onError })
        break
      case 'unpublish':
        mutations.unpublish.mutate(undefined, { onSuccess, onError })
        break
      case 'restore':
        mutations.restore.mutate(undefined, { onSuccess, onError })
        break
    }
  }

  return (
    <header className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-background/95 px-1 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link
            to="/courses"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            aria-label="Back to courses"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
            Courses
          </Link>
          <span aria-hidden="true" className="text-muted-foreground">
            /
          </span>
          {/*
              The title wraps rather than clamping: a 300-character Amharic title
              grows the header to ~3 lines instead of being cut off (S-2.6
              validation rule). `min-w-0` + `break-words` is what lets it.
            */}
          <CourseTitleEditor
            coursePublicId={coursePublicId}
            title={lifecycle.title}
            state={lifecycle.state}
            editable={isAuthoring}
          />
          <StatusPill tone={lifecycle.state} />
          <span className="text-xs text-muted-foreground">v{lifecycle.version}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {previewBaseUrl ? (
            <a
              href={`${previewBaseUrl.replace(/\/+$/, '')}/courses/${encodeURIComponent(coursePublicId)}`}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <HugeiconsIcon icon={ViewIcon} className="size-4" />
              Preview
            </a>
          ) : null}
          {/*
              Reviewer and Viewer are out of capability for authoring, so the
              whole action group is **absent** — not a disabled ⋯ (case 1).
            */}
          {isAuthoring ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                aria-label="More course actions"
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setConfirming('archive')}>
                  Archive
                </DropdownMenuItem>
                {lifecycle.state === 'published' ? (
                  <DropdownMenuItem onClick={() => setConfirming('unpublish')}>
                    Unpublish
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <LifecycleStepper state={lifecycle.state} />
        {/*
            The lifecycle CTA is disabled-with-a-reason when readiness blocks it,
            never a silent no-op (case 2). The reason lives in `aria-describedby`
            as well as the tooltip so it is announced, not just visible.
        */}
        {cta && isAuthoring ? (
          <LifecycleCtaButton
            label={cta.label}
            action={cta.action}
            state={lifecycle.state}
            itemsNeedingContent={lifecycle.itemsNeedingContent}
            requiresApproval={lifecycle.requiresApproval}
            onRun={runLifecycle}
          />
        ) : null}
        <LifecycleStatusLine lifecycle={lifecycle} />
      </div>

      <ConfirmDialog
        open={confirming === 'archive'}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Archive this course?"
        body="Archived courses leave the catalog. Enrolled students keep their access and earned certificates."
        confirmLabel="Archive"
        onConfirm={() => {
          void mutations.archive.mutateAsync().then(() => {
            toast.success('Course archived.')
            void navigate({ to: '/courses' })
          })
        }}
      />
      <ConfirmDialog
        open={confirming === 'unpublish'}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Unpublish this course?"
        body="New enrolment stops immediately. Enrolled students keep access for the 14-day grace period."
        confirmLabel="Unpublish"
        destructive
        onConfirm={() => {
          void mutations.unpublish
            .mutateAsync()
            .then(() =>
              toast.success('Course unpublished. Students keep access during the grace period.'),
            )
        }}
      />
    </header>
  )
}

/**
 * The five-node lifecycle stepper. `Approved` is the fourth node and is filled
 * only for a course sitting between review and publication — which is why the
 * stepper reads the *derived* state, not `courses.status`.
 */
function LifecycleStepper({ state }: { state: CourseLifecycleState }) {
  const activeIndex = COURSE_LIFECYCLE_ORDER.indexOf(state)
  return (
    <ol className="flex items-center gap-1" aria-label="Course lifecycle">
      {COURSE_LIFECYCLE_ORDER.map((candidate, index) => {
        const isDone = index < activeIndex
        const isCurrent = index === activeIndex
        return (
          <li key={candidate} className="flex items-center gap-1">
            <span
              className={
                'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ' +
                (isCurrent
                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                  : isDone
                    ? 'text-violet-600 dark:text-violet-400'
                    : 'text-muted-foreground/60')
              }
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                aria-hidden="true"
                className={
                  'size-1.5 rounded-full ' +
                  (isCurrent || isDone ? 'bg-current' : 'bg-muted-foreground/30')
                }
              />
              {COURSE_LIFECYCLE_LABELS[candidate]}
            </span>
            {index < COURSE_LIFECYCLE_ORDER.length - 1 ? (
              <span aria-hidden="true" className="h-px w-3 bg-muted-foreground/20" />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function LifecycleCtaButton({
  label,
  action,
  state,
  itemsNeedingContent,
  requiresApproval,
  onRun,
}: {
  label: string
  action: 'submit' | 'withdraw' | 'publish' | 'unpublish' | 'restore'
  state: CourseLifecycleState
  itemsNeedingContent: number
  requiresApproval: boolean
  onRun: (action: 'submit' | 'withdraw' | 'publish' | 'unpublish' | 'restore') => void
}) {
  const reasonId = useId()
  // Publishing out of Draft on a gated course is blocked for an Editor: they
  // cannot self-approve, so the CTA stays disabled with the reason rather than
  // reaching a server that will refuse it.
  const blockedByApproval = action === 'publish' && state === 'draft' && requiresApproval
  const blockedByReadiness =
    (action === 'publish' || action === 'submit') && itemsNeedingContent > 0
  const reason = blockedByApproval
    ? 'Submit for review instead — an Editor cannot self-approve this course.'
    : blockedByReadiness
      ? `${itemsNeedingContent} item${itemsNeedingContent === 1 ? '' : 's'} need content before this course can be published.`
      : null

  return (
    <>
      <Button
        size="sm"
        disabled={reason != null}
        aria-describedby={reason != null ? reasonId : undefined}
        title={reason ?? undefined}
        onClick={() => onRun(action)}
      >
        {label}
      </Button>
      {reason != null ? (
        <span id={reasonId} className="text-xs text-muted-foreground">
          {reason}
        </span>
      ) : null}
    </>
  )
}

/** The state line under the stepper: one sentence about where the course is. */
function LifecycleStatusLine({ lifecycle }: { lifecycle: CourseLifecycleView }) {
  if (lifecycle.state === 'approved' && lifecycle.approvedAt) {
    return (
      <p className="text-xs text-green-700 dark:text-green-400">
        Approved {new Date(lifecycle.approvedAt).toLocaleString()} · ready to publish
      </p>
    )
  }
  if (lifecycle.state === 'published' && lifecycle.publishedAt) {
    return (
      <p className="text-xs text-green-700 dark:text-green-400">
        Live since {new Date(lifecycle.publishedAt).toLocaleString()}
      </p>
    )
  }
  if (lifecycle.state === 'in_review') {
    return <p className="text-xs text-amber-700 dark:text-amber-400">Submitted for review</p>
  }
  if (lifecycle.state === 'archived') {
    return (
      <p className="text-xs text-muted-foreground">
        This course is archived. Restore it to make changes.
      </p>
    )
  }
  return null
}

// ── Workspace nav ──────────────────────────────────────────────────────────

function WorkspaceNav({
  coursePublicId,
  role,
  tabs,
  activeTab,
}: {
  coursePublicId: string
  role: string
  tabs: readonly CourseWorkspaceTab[]
  activeTab: CourseWorkspaceTab
}) {
  const navigate = useNavigate()
  const studentCount = useQuery({
    ...courseStudentsQueryOptionsFn(coursePublicId),
    enabled: tabs.includes('students'),
  })

  return (
    <nav aria-label="Course workspace sections">
      <ul className="flex flex-wrap gap-1 border-b">
        {tabs.map((candidate) => {
          const isActive = candidate === activeTab
          const count =
            candidate === 'students' && studentCount.data != null ? studentCount.data : null
          return (
            <li key={candidate}>
              <button
                type="button"
                aria-current={isActive ? 'page' : undefined}
                className={
                  'border-b-2 px-3 py-2 text-sm ' +
                  (isActive
                    ? 'border-violet-500 font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground')
                }
                onClick={() =>
                  void navigate({
                    to: '/courses/$courseId',
                    params: { courseId: coursePublicId },
                    search: { tab: candidate },
                  })
                }
              >
                {WORKSPACE_TAB_LABELS[candidate]}
                {COUNTED_WORKSPACE_TABS.includes(candidate) && count != null ? (
                  <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                    ({count})
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
      {role === 'support' ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Support sees the student roster for this course.
        </p>
      ) : null}
    </nav>
  )
}

// ── Readiness banner ───────────────────────────────────────────────────────

/**
 * The readiness banner (S-2.6 wireframe). The count it quotes is
 * `ReadinessResult.itemsNeedingContent` — the same value the S-2.22 checklist
 * and the Course health card read, so the three surfaces cannot disagree.
 *
 * Absent for roles that cannot act on it: a Reviewer's readiness block is
 * replaced by the review decision panel, and Support never sees readiness.
 */
function ReadinessBanner({
  coursePublicId,
  role,
  itemsNeedingContent,
  onOpenReadiness,
}: {
  coursePublicId: string
  role: string
  itemsNeedingContent: number
  onOpenReadiness?: () => void
}) {
  const navigate = useNavigate()
  if (role === 'support' || role === 'reviewer' || role === 'viewer') return null
  if (itemsNeedingContent <= 0) return null

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
    >
      <span>
        {itemsNeedingContent} item{itemsNeedingContent === 1 ? '' : 's'} need content before this
        course can be published.
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void navigate({
              to: '/courses/$courseId',
              params: { courseId: coursePublicId },
              search: { tab: 'curriculum' },
            })
          }
        >
          Jump to curriculum
        </Button>
        {onOpenReadiness ? (
          <Button variant="outline" size="sm" onClick={onOpenReadiness}>
            Review checklist
          </Button>
        ) : null}
      </div>
    </div>
  )
}
