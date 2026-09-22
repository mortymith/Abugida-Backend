import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { toast } from '#/components/common/toast'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import { Label } from '#/components/ui/label'
import { Spinner } from '#/components/ui/spinner'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { StatusPill } from './courses.status-pill'
import {
  courseQueryKeys,
  reviewPreviewQueryOptions,
  reviewQueueQueryOptionsFn,
} from '../hooks/courses.queries'
import { REVIEW_STATE_LABELS } from '../courses.review-state'
import type { ReviewState } from '../schemas/courses.workflow.schema'
import type { ReviewQueueItem } from '../courses.types'

const TABS: Array<{ state: ReviewState; label: string }> = [
  { state: 'pending', label: 'Pending' },
  { state: 'changes_requested', label: 'Changes Requested' },
  { state: 'approved', label: 'Approved' },
  { state: 'rejected', label: 'Rejected' },
]

/**
 * S-2.14 Review & Approval Queue: tabs with counts, queue table, review
 * panel with student-accurate preview, checklist, comment, and decision
 * buttons (disabled until the preview is opened; empty-comment decisions
 * confirmed via S-7.1). Workflow gear toggles per-course gating (admin).
 */
export function ReviewsQueue({ role }: { role: string }) {
  const search = useSearch({ from: '/_app/courses/reviews' })
  const queryClient = useQueryClient()
  const [state, setState] = useState<ReviewState>((search.state ?? 'pending') as ReviewState)
  const [active, setActive] = useState<ReviewQueueItem | null>(null)
  const [previewOpened, setPreviewOpened] = useState(false)
  const [comment, setComment] = useState('')
  const [confirmDecision, setConfirmDecision] = useState<'approve' | 'reject' | null>(null)

  const canDecide = role === 'admin' || role === 'reviewer'
  const queue = useQuery(reviewQueueQueryOptionsFn({ state }))
  const preview = useQuery({
    ...reviewPreviewQueryOptions(active?.lessonPublicId ?? ''),
    enabled: Boolean(active),
  })

  const decide = useMutation({
    mutationFn: async (input: {
      decision: 'approve' | 'request_changes' | 'reject'
      comment: string
    }) => {
      if (!active) throw new Error('Pick a review first')
      const { decideReview } = await import('../server/all')
      return decideReview({
        data: {
          reviewPublicId: active.reviewPublicId,
          decision: input.decision,
          comment: input.comment || undefined,
        },
      })
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['courses', 'reviews'] })
      void queryClient.invalidateQueries({ queryKey: courseQueryKeys.pendingReviews() })
      toast.success(
        variables.decision === 'approve'
          ? 'Approved — the author can publish.'
          : variables.decision === 'request_changes'
            ? 'Changes requested — the author was notified.'
            : 'Rejected — the author was notified.',
      )
      setActive(null)
      setComment('')
      setPreviewOpened(false)
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Decision failed'),
  })

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Approval Queue</h1>
          <p className="text-sm text-muted-foreground">
            Draft → In Review → Changes Requested → Approved → Published
          </p>
        </div>
      </header>

      <div role="tablist" aria-label="Review states" className="flex flex-wrap gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.state}
            role="tab"
            aria-selected={state === tab.state}
            className={
              'border-b-2 px-3 py-2 text-sm' +
              (state === tab.state
                ? ' border-violet-500 font-medium'
                : ' border-transparent text-muted-foreground hover:text-foreground')
            }
            onClick={() => {
              setState(tab.state)
              setActive(null)
            }}
          >
            {tab.label}
            {tab.state === state && queue.data ? ` (${queue.data.length})` : ''}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <section aria-label="Queue">
          {queue.isPending ? (
            <Spinner className="mx-auto my-8" />
          ) : queue.isError ? (
            <RetryErrorState onRetry={() => void queue.refetch()} />
          ) : queue.data.length === 0 ? (
            <EmptyState
              title={state === 'pending' ? 'No lessons waiting for review. 🎉' : 'Nothing here.'}
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th scope="col" className="px-3 py-2">
                      Lesson
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Course
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Author
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Submitted
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {queue.data.map((item) => (
                    <tr key={item.reviewPublicId} className="border-t">
                      <td className="px-3 py-2 font-medium">{item.lessonTitle}</td>
                      <td className="px-3 py-2">{item.courseTitle}</td>
                      <td className="px-3 py-2">{item.requesterName ?? '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {relativeTime(item.submittedAt)}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill
                          tone={item.state}
                          label={
                            item.state === 'pending'
                              ? 'In Review'
                              : item.state === 'rejected'
                                ? 'Rejected'
                                : REVIEW_STATE_LABELS[item.state]
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            setActive(item)
                            setPreviewOpened(true)
                          }}
                        >
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside aria-label="Review panel" className="rounded-xl border bg-card p-4 shadow-sm">
          {!active ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Select a lesson to review. Decision buttons unlock once the preview is open.
            </p>
          ) : preview.isPending ? (
            <Spinner className="mx-auto my-8" />
          ) : preview.isError ? (
            <RetryErrorState onRetry={() => void preview.refetch()} />
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <h2 className="font-semibold">{preview.data.lessonTitle}</h2>
                <p className="text-xs text-muted-foreground">
                  Student-accurate preview · {preview.data.durationMinutes ?? '—'} min
                </p>
              </div>

              {preview.data.videoUrl ? (
                <p className="rounded-lg bg-muted/40 p-2 text-xs break-all">
                  ▶ Video:{' '}
                  <a
                    href={preview.data.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {preview.data.videoUrl}
                  </a>
                </p>
              ) : null}

              <div className="max-h-56 overflow-auto rounded-lg border p-3 text-sm [&_a]:underline [&_h2]:font-semibold [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-4">
                {preview.data.body ? (
                  <div dangerouslySetInnerHTML={{ __html: preview.data.body }} />
                ) : (
                  <p className="text-muted-foreground">
                    ⚠️ No content body — flag this in your decision.
                  </p>
                )}
              </div>

              {preview.data.quiz ? (
                <details className="rounded-lg border p-2 text-sm">
                  <summary className="cursor-pointer font-medium">
                    Quiz: {preview.data.quiz.title} ({preview.data.quiz.questions.length} questions)
                  </summary>
                  <ul className="mt-1 ml-4 list-decimal">
                    {preview.data.quiz.questions.map((question, index) => (
                      <li key={index} className="text-xs">
                        {question.questionText}
                        <span className="block text-muted-foreground">
                          {question.options.join(' · ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              <fieldset className="rounded-lg border p-2 text-xs">
                <legend className="px-1 font-medium">Reviewer checklist</legend>
                <label className="flex items-center gap-1">
                  <input type="checkbox" defaultChecked={false} /> Media plays
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" defaultChecked={false} /> Quiz answers keyed
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" defaultChecked={false} /> Links work
                </label>
              </fieldset>

              {active.submissionNote ? (
                <p className="rounded bg-muted/40 p-2 text-xs">
                  Author note: {active.submissionNote}
                </p>
              ) : null}

              {canDecide ? (
                <>
                  <div>
                    <Label htmlFor="review-comment">Comment (required for changes/reject)</Label>
                    <Textarea
                      id="review-comment"
                      rows={2}
                      value={comment}
                      placeholder="Explain what should change…"
                      onChange={(event) => setComment(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={!previewOpened || decide.isPending}
                      onClick={() => {
                        if (comment.trim() === '') setConfirmDecision('approve')
                        else decide.mutate({ decision: 'approve', comment })
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!previewOpened || decide.isPending || !comment.trim()}
                      onClick={() => decide.mutate({ decision: 'request_changes', comment })}
                    >
                      Request Changes
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!previewOpened || decide.isPending}
                      onClick={() => {
                        if (comment.trim() === '') setConfirmDecision('reject')
                        else decide.mutate({ decision: 'reject', comment })
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Reviewers decide; editors submit; viewers read-only (spec 11 matrix).
                </p>
              )}
            </div>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDecision != null}
        onOpenChange={(open) => !open && setConfirmDecision(null)}
        title={
          confirmDecision === 'approve' ? 'Approve without a comment?' : 'Reject without a comment?'
        }
        body="The author will receive your decision without reviewer notes. Add a comment to explain why."
        confirmLabel="Confirm without comment"
        destructive={confirmDecision === 'reject'}
        onConfirm={() => {
          const decision = confirmDecision
          setConfirmDecision(null)
          return decision
            ? decide.mutateAsync({ decision, comment }).then(() => undefined)
            : undefined
        }}
      />
    </div>
  )
}

function relativeTime(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
