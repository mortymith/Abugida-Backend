import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { requireRolesBeforeLoad } from '#/features/auth'
import { LessonEditor, QuizBuilderModal, AiQuizModal } from '#/features/courses'
import type { AiQuizQuestionDraft } from '#/features/courses'

export const Route = createFileRoute('/_app/courses/$courseId/lessons/$lessonId')({
  beforeLoad: () => requireRolesBeforeLoad(['admin', 'editor']),
  component: LessonEditorRoute,
})

function LessonEditorRoute() {
  const { courseId, lessonId } = Route.useParams()
  const [quizBuilderOpen, setQuizBuilderOpen] = useState(false)
  const [aiQuizOpen, setAiQuizOpen] = useState(false)
  const [quizDraft, setQuizDraft] = useState<AiQuizQuestionDraft[] | null>(null)

  return (
    <>
      <LessonEditor
        courseId={courseId}
        lessonId={lessonId}
        onOpenQuizBuilder={() => setQuizBuilderOpen(true)}
        onOpenAiQuiz={() => setAiQuizOpen(true)}
      />
      {quizBuilderOpen ? (
        <QuizBuilderModal
          lessonPublicId={lessonId}
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
          lessonPublicId={lessonId}
          onAccept={(questions) => {
            setQuizDraft(questions)
            setAiQuizOpen(false)
            setQuizBuilderOpen(true)
          }}
        />
      ) : null}
    </>
  )
}
