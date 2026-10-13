import { useEffect, useId, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '#/components/common/toast'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { courseQueryKeys } from '../hooks/courses.queries'
import {
  COURSE_TITLE_MAX_GRAPHEMES,
  COURSE_TITLE_MIN_GRAPHEMES,
  fieldLockReason,
  resolveFieldLock,
} from '../courses.field-lock'
import type { CourseLifecycleState } from '../courses.workspace'

/**
 * The inline course-title editor (S-2.6 identity header, primary action 2).
 *
 * "Autosaves; `Enter` or blur commits, `Esc` reverts." The heading itself is
 * replaced by the input while editing and the workspace nav stays mounted, so a
 * 300-character Amharic title growing the header does not shift the layout.
 *
 * Length is measured in **grapheme clusters**, not code units: Ethiopic
 * composes, so `[...title].length` would undercount and reject a valid title.
 * The heading is never line-clamped — it wraps, and the header row grows.
 *
 * The lock comes from `resolveFieldLock('course.title', state)`, so an Approved
 * course renders the control disabled with the reason *"Approved — editing
 * clears the approval"* rather than accepting an edit that would silently
 * invalidate the review.
 */
export function CourseTitleEditor({
  coursePublicId,
  title,
  state,
  editable,
}: {
  coursePublicId: string
  title: string
  state: CourseLifecycleState
  /** False for Reviewer/Viewer/Support — case 1, the control is absent entirely. */
  editable: boolean
}) {
  const queryClient = useQueryClient()
  const reasonId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<string | null>(null)

  const lock = resolveFieldLock('course.title', state)
  const reason = fieldLockReason('course.title', state)

  const save = useMutation({
    mutationFn: async (next: string) => {
      const { saveCourseTitle } = await import('../server/all')
      return saveCourseTitle({ data: { coursePublicId, title: next } })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: courseQueryKeys.details(coursePublicId),
      })
      void queryClient.invalidateQueries({ queryKey: courseQueryKeys.detailsAll() })
      void queryClient.invalidateQueries({ queryKey: courseQueryKeys.readiness(coursePublicId) })
      toast.success('Title saved.')
    },
    onError: (cause) => {
      toast.error(cause instanceof Error ? cause.message : 'Could not save the title.')
      // Revert on failure: an invalid input must not stay in the heading.
      setDraft(null)
    },
  })

  // Focus the input the moment the heading turns into one, so keyboard users
  // land in the field rather than having to reach for it.
  useEffect(() => {
    if (draft !== null) inputRef.current?.focus()
  }, [draft])

  // Out of capability → absent (case 1). Reviewer and Viewer never see an
  // editable title, not a disabled one.
  if (!editable) {
    return <h1 className="min-w-0 break-words font-display text-2xl font-bold">{title}</h1>
  }

  if (draft !== null) {
    const length = [...draft].length
    const tooShort = length < COURSE_TITLE_MIN_GRAPHEMES
    const tooLong = length > COURSE_TITLE_MAX_GRAPHEMES
    const invalid = tooShort || tooLong
    return (
      <span className="flex min-w-0 flex-col gap-1">
        <Input
          ref={inputRef}
          value={draft}
          aria-label="Course title"
          aria-invalid={invalid || undefined}
          aria-describedby={reason != null ? reasonId : undefined}
          disabled={lock.mode === 'disabled'}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (!invalid && draft.trim() !== title) save.mutate(draft.trim())
            setDraft(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              if (!invalid && draft.trim() !== title) save.mutate(draft.trim())
              setDraft(null)
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setDraft(null)
            }
          }}
          className="h-8 max-w-xl font-display text-xl font-bold"
        />
        {invalid ? (
          <span className="text-xs text-destructive" role="alert">
            {tooShort
              ? `At least ${COURSE_TITLE_MIN_GRAPHEMES} characters.`
              : `At most ${COURSE_TITLE_MAX_GRAPHEMES} characters.`}
          </span>
        ) : null}
        {save.isPending ? <Spinner className="size-4" /> : null}
      </span>
    )
  }

  return (
    <span className="flex min-w-0 flex-col gap-1">
      <button
        type="button"
        // Case 2: present but inert, with the reason in both the tooltip and
        // `aria-describedby` — never a silent no-op.
        disabled={lock.mode === 'disabled'}
        aria-describedby={reason != null ? reasonId : undefined}
        title={reason ?? undefined}
        onClick={() => setDraft(title)}
        className="min-w-0 break-words text-left font-display text-2xl font-bold hover:underline"
      >
        {title}
      </button>
      {reason != null ? (
        <span id={reasonId} className="text-xs text-muted-foreground">
          {reason}
        </span>
      ) : null}
    </span>
  )
}
