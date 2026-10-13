import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { toast } from '#/components/common/toast'
import { Button, buttonVariants } from '#/components/ui/button'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { Spinner } from '#/components/ui/spinner'
import { StatusPill } from './courses.status-pill'
import {
  courseAnalyticsQueryOptions,
  courseDetailsQueryOptions,
  curriculumQueryOptions,
} from '../hooks/courses.queries'
import { readinessItemsNeedingContent, usePublishReadiness } from '../hooks/courses.workspace-hooks'
import { deriveAuthoringHealth } from '../courses.readiness'
import {
  COURSE_LIFECYCLE_LABELS,
  deriveCourseLifecycleState,
  isInPublishedSet,
} from '../courses.workspace'
import type { CourseLifecycleState } from '../courses.workspace'

/**
 * S-2.6 Course Workspace — Overview: the landing tab.
 *
 * "What state is this course in, what is blocking it, and what do I do next."
 * The health cards, the publishing line and the readiness number all read the
 * **same** queries the shell and the S-2.22 checklist read, so the numbers
 * cannot drift between surfaces — the spec's central Revision-3 complaint.
 *
 * Publishing status, "where students are" and the course meta come from
 * `courseDetails` / `curriculum` / `courseAnalytics`; nothing here re-fetches
 * what the shell already holds in cache.
 */
export function CourseOverview({ coursePublicId, role }: { coursePublicId: string; role: string }) {
  const details = useQuery(courseDetailsQueryOptions(coursePublicId))
  const curriculum = useQuery(curriculumQueryOptions(coursePublicId))
  const analytics = useQuery({
    ...courseAnalyticsQueryOptions(coursePublicId),
    enabled: role !== 'support',
  })
  const readiness = usePublishReadiness(coursePublicId)

  if (details.isPending) return <Spinner className="mx-auto my-12" />
  if (details.isError) {
    return (
      <RetryErrorState
        onRetry={() => void details.refetch()}
        description="Unable to load this course. Retry?"
      />
    )
  }

  const course = details.data
  const state: CourseLifecycleState = deriveCourseLifecycleState({
    status: course.status,
    approvedAt: course.approvedAt,
  })
  const modules = curriculum.data?.modules ?? []
  const items = modules.flatMap((module) => module.lessons)
  const publishedCount = items.filter((item) =>
    isInPublishedSet({
      visibility: item.visibility,
      archivedAt: item.archivedAt,
      deletedAt: item.deletedAt,
    }),
  ).length
  const itemsNeedingContent = readinessItemsNeedingContent(readiness.data)
  const health = deriveAuthoringHealth(readiness.data ?? emptyReadiness(), {
    totalItemCount: items.length,
    awaitingReviewCount: items.filter((item) => item.reviewStatus === 'in_review').length,
    changesRequestedCount: items.filter((item) => item.reviewStatus === 'changes_requested').length,
    scheduledPublishAt: course.scheduledPublishAt,
    publishedItemCount: publishedCount,
  })

  return (
    <div className="flex flex-col gap-4">
      {/*
          Course health: four cards, every number from one source. The
          "items need content" card quotes `itemsNeedingContent` — the same
          `RC-4a` count the readiness banner and S-2.22 show.
      */}
      <section aria-label="Course health" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HealthCard
          label="Lifecycle"
          value={COURSE_LIFECYCLE_LABELS[state]}
          hint={course.requiresApproval ? 'Approval required' : 'Publishes directly'}
        />
        <HealthCard
          label="Sections published"
          value={`${publishedCount} / ${items.length}`}
          hint={`${modules.length} section${modules.length === 1 ? '' : 's'}`}
        />
        <HealthCard
          label="Items need content"
          value={String(itemsNeedingContent)}
          tone={itemsNeedingContent > 0 ? 'warn' : 'ok'}
          hint={itemsNeedingContent > 0 ? 'Blocks publishing' : 'Ready to publish'}
        />
        <HealthCard
          label="Avg rating"
          value={
            analytics.data?.averageRating == null
              ? '—'
              : `${analytics.data.averageRating.toFixed(1)} ★`
          }
          hint={
            analytics.data && analytics.data.ratingCount > 0
              ? `${analytics.data.ratingCount} ratings`
              : 'No ratings yet'
          }
        />
      </section>

      {/* Publishing + authoring health: the "what do I do next" column. */}
      <section aria-label="Publishing" className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Publishing</h2>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="flex items-center gap-2">
              <StatusPill tone={state} />
              {course.scheduledPublishAt ? (
                <span className="text-xs text-muted-foreground">
                  scheduled {new Date(course.scheduledPublishAt).toLocaleString()}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Authoring health</dt>
            <dd>{healthLabel(health.variant, health.count)}</dd>
          </div>
        </dl>
        {health.nextAction ? (
          <Link
            to="/courses/$courseId"
            params={{ courseId: coursePublicId }}
            search={{ tab: health.nextAction.screen === 'readiness' ? 'curriculum' : 'curriculum' }}
            className="mt-2 inline-block text-sm text-violet-600 hover:underline"
          >
            {health.nextAction.label} →
          </Link>
        ) : null}
      </section>

      {/* Where students are: only meaningful once the course is live. */}
      {state === 'published' ? (
        <section aria-label="Where students are" className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">Where students are</h2>
          {analytics.data && analytics.data.moduleBreakdown.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-2">
              {analytics.data.moduleBreakdown.map((module) => (
                <li key={module.moduleTitle} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0 truncate">{module.moduleTitle}</span>
                  <span
                    className="h-2 flex-1 rounded-full bg-muted"
                    role="img"
                    aria-label={`${module.moduleTitle}: ${module.avgProgress ?? 0}% average progress`}
                  >
                    <span
                      className="block h-full rounded-full bg-violet-500"
                      style={{ width: `${module.avgProgress ?? 0}%` }}
                    />
                  </span>
                  <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">
                    {module.avgProgress == null ? '—' : `${module.avgProgress}%`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              variant="compact"
              title="No students yet"
              description="Your course is invisible until you publish it."
            />
          )}
          <Link
            to="/courses/$courseId"
            params={{ courseId: coursePublicId }}
            search={{ tab: 'analytics' }}
            className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' mt-3'}
          >
            Full analytics →
          </Link>
        </section>
      ) : (
        <EmptyState
          title="No students yet"
          description="Your course is invisible until you publish it."
        />
      )}

      {/* Course meta + the ⋯ equivalents that used to live in the old header. */}
      <section aria-label="Course" className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Course</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {course.examTypeName ?? 'No exam type'} · {course.level ?? 'No level'} ·{' '}
          {course.instructorName ?? 'No instructor'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/courses/$courseId"
            params={{ courseId: coursePublicId }}
            search={{ tab: 'settings' }}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Edit details
          </Link>
          <DuplicateButton coursePublicId={coursePublicId} />
          <Link
            to="/courses/$courseId"
            params={{ courseId: coursePublicId }}
            search={{ tab: 'settings' }}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            Archive
          </Link>
        </div>
      </section>
    </div>
  )
}

function HealthCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'neutral' | 'ok' | 'warn'
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          'font-display text-xl font-bold tabular-nums ' +
          (tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : '')
        }
      >
        {value}
      </p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function healthLabel(variant: string, count: number): string {
  switch (variant) {
    case 'not_started':
      return 'Not started'
    case 'needs_content':
      return `${count} item${count === 1 ? '' : 's'} need content`
    case 'awaiting_review':
      return `${count} awaiting review`
    case 'changes_requested':
      return `${count} need changes`
    case 'ready_to_review':
      return 'Ready to submit for review'
    case 'ready_to_publish':
      return 'Ready to publish'
    case 'scheduled':
      return 'Scheduled'
    case 'live':
      return 'Live'
    default:
      return variant
  }
}

function DuplicateButton({ coursePublicId }: { coursePublicId: string }) {
  const duplicate = useMutationLike(() => {
    void (async () => {
      const { duplicateCourse } = await import('../server/all')
      const result = await duplicateCourse({ data: { coursePublicId } })
      toast.success('Draft copy created.')
      return result
    })()
  })
  return (
    <Button variant="ghost" size="sm" onClick={duplicate}>
      Duplicate
    </Button>
  )
}

/** Tiny indirection so the duplicate button stays a component without a hook. */
function useMutationLike(run: () => void) {
  return run
}

/**
 * The readiness result the health derivation needs when the query has not
 * settled. An all-passing result rather than `null` keeps the card from
 * rendering a false "3 items need content" on first paint.
 */
function emptyReadiness() {
  return {
    checks: [],
    passCount: 0,
    blockingFailures: 0,
    itemsNeedingContent: 0,
    failingByKind: { lesson: 0, quiz: 0, assignment: 0 },
    publishedItemCount: 0,
  }
}
