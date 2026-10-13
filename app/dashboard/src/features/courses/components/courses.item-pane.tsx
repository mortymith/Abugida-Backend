import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Button, buttonVariants } from '#/components/ui/button'
import { EmptyState } from '#/components/common/empty-state'
import { Spinner } from '#/components/ui/spinner'
import { LessonEditor, QuizBuilderModal, AiQuizModal } from '../index'
import type { AiQuizQuestionDraft } from '../courses.types'
import { curriculumQueryOptions } from '../hooks/courses.queries'
import {
  buildLessonAliasHref,
  CURRICULUM_ITEM_KIND_LABELS,
  deriveCurriculumItemKind,
  itemVisibilityPillLabel,
} from '../courses.workspace'

/**
 * S-2.17 item pane — the in-workspace editor host.
 *
 * The spec makes the standalone lesson route an **alias** for this pane: one
 * editor, two hosts. That only holds if this pane actually renders the same
 * `LessonEditor` the old route did, with the same quiz/AI modals — otherwise the
 * alias redirect would delete the only path to editing, which is worse than a
 * known duplication.
 *
 * The pane reads `?item=` from the workspace route and keeps the selection in
 * the URL, so the item is linkable, bookmarkable and back-button safe, and a
 * reload lands on the same item rather than an unselected tree.
 */
export function CurriculumItemPane({
  coursePublicId,
  itemPublicId,
  authoring,
}: {
  coursePublicId: string
  /** `undefined` when no item is selected — the pane renders an empty state. */
  itemPublicId?: string
  authoring: boolean
}) {
  const [quizBuilderOpen, setQuizBuilderOpen] = useState(false)
  const [aiQuizOpen, setAiQuizOpen] = useState(false)
  const [quizDraft, setQuizDraft] = useState<AiQuizQuestionDraft[] | null>(null)
  const curriculum = useQuery(curriculumQueryOptions(coursePublicId))

  if (!itemPublicId) {
    return (
      <EmptyState
        title="No item selected"
        description="Pick an item in the curriculum tree to open it here."
      />
    )
  }

  // The item's row, read from the curriculum the tree already fetched — a second
  // request for the title and kind would be a second source of truth for the
  // same row, and the pane header would disagree with the tree on a rename.
  const lesson = curriculum.data?.modules
    .flatMap((module) => module.lessons)
    .find((entry) => entry.publicId === itemPublicId)

  if (curriculum.isPending) return <Spinner className="mx-auto my-12" />

  if (!lesson) {
    // A remembered or stale `?item=` that the curriculum no longer contains:
    // say so rather than opening an editor for an item that is gone.
    return (
      <EmptyState
        title="This item is no longer in the curriculum"
        description="It may have been deleted, or moved to another course."
        action={
          <Link
            to="/courses/$courseId"
            params={{ courseId: coursePublicId }}
            search={{ tab: 'curriculum' }}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Back to the curriculum
          </Link>
        }
      />
    )
  }

  const kind = deriveCurriculumItemKind(lesson.contentType)
  const visibilityLabel = itemVisibilityPillLabel(lesson.visibility, lesson.scheduledPublishAt)

  return (
    <section className="flex flex-col gap-3" aria-label={`Item: ${lesson.title}`}>
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 break-words font-display text-lg font-bold">{lesson.title}</h2>
        {kind ? (
          <span className="text-xs text-muted-foreground">{CURRICULUM_ITEM_KIND_LABELS[kind]}</span>
        ) : null}
        {visibilityLabel ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{visibilityLabel}</span>
        ) : null}
        {/*
            The alias href is what the pane hands to anything that still needs a
            standalone lesson URL (search results, notifications, Media's "Used
            in" list). Building it here keeps the alias path in one place.
        */}
        <Link
          to={buildLessonAliasHref(`/courses/${coursePublicId}`, lesson.publicId)}
          className="ml-auto text-xs text-violet-600 hover:underline"
        >
          Open standalone ↗
        </Link>
      </header>

      <LessonEditor
        courseId={coursePublicId}
        lessonId={lesson.publicId}
        onOpenQuizBuilder={() => setQuizBuilderOpen(true)}
        onOpenAiQuiz={() => setAiQuizOpen(true)}
      />

      {quizBuilderOpen ? (
        <QuizBuilderModal
          lessonPublicId={lesson.publicId}
          initialDraft={quizDraft}
          onClose={() => {
            setQuizBuilderOpen(false)
            setQuizDraft(null)
          }}
          onOpenAiQuiz={() => setAiQuizOpen(true)}
        />
      ) : null}
      {aiQuizOpen ? (
        <AiQuizModal
          open={aiQuizOpen}
          onOpenChange={setAiQuizOpen}
          lessonPublicId={lesson.publicId}
          onAccept={(questions) => {
            setQuizDraft(questions)
            setAiQuizOpen(false)
            setQuizBuilderOpen(true)
          }}
        />
      ) : null}

      {!authoring ? (
        <p className="text-xs text-muted-foreground">You have read-only access to this item.</p>
      ) : null}
      <Button variant="ghost" size="sm" className="self-start" onClick={() => void history.back()}>
        Back to the tree
      </Button>
    </section>
  )
}
