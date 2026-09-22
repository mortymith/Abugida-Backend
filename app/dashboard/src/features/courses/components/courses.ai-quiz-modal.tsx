import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from '#/components/common/toast'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { Spinner } from '#/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import type { AiQuizQuestionDraft, AiQuizDraft } from '../courses.types'

/**
 * S-2.16 AI Quiz Generator: pick count/types/difficulty → editable draft
 * cards (per-question regenerate/edit/delete) → "Open in Quiz Builder"
 * hands the reviewed draft off. Requires ≥200 words of lesson content.
 */
export function AiQuizModal({
  open,
  onOpenChange,
  lessonPublicId,
  onAccept,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lessonPublicId: string
  onAccept: (questions: AiQuizQuestionDraft[]) => void
}) {
  const [questionCount, setQuestionCount] = useState(5)
  const [types, setTypes] = useState<Array<'multiple_choice' | 'true_false' | 'short_answer'>>([
    'multiple_choice',
    'true_false',
  ])
  const [difficulty, setDifficulty] = useState<'easy' | 'mixed' | 'hard'>('mixed')
  const [draft, setDraft] = useState<AiQuizDraft | null>(null)

  const generate = useMutation({
    mutationFn: async (excludePrompts: string[]) => {
      const { generateQuizDraft, regenerateQuizQuestion } = await import('../server/all')
      if (excludePrompts.length === 0 && !draft) {
        return generateQuizDraft({ data: { lessonPublicId, questionCount, types, difficulty } })
      }
      return regenerateQuizQuestion({
        data: { lessonPublicId, questionCount, types, difficulty, excludePrompts },
      })
    },
    onSuccess: (result) => {
      if (!draft) {
        setDraft(result)
        return
      }
      setDraft({ ...draft, questions: [...draft.questions, ...result.questions] })
    },
    onError: (cause) => {
      const message = cause instanceof Error ? cause.message : 'Generation failed'
      if (message.includes('CONTENT_TOO_SHORT')) {
        toast.error('This lesson needs at least 200 words of content to generate a quiz.')
      } else {
        toast.error(message.replace(/^[A-Z_]+:\s*/, ''))
      }
    },
  })

  const patchQuestion = (index: number, patch: Partial<AiQuizQuestionDraft>) =>
    setDraft((previous) =>
      previous
        ? {
            ...previous,
            questions: previous.questions.map((question, candidate) =>
              candidate === index ? { ...question, ...patch } : question,
            ),
          }
        : previous,
    )

  const removeQuestion = (index: number) =>
    setDraft((previous) =>
      previous
        ? {
            ...previous,
            questions: previous.questions.filter((_, candidate) => candidate !== index),
          }
        : previous,
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            AI Quiz Generator <span aria-hidden>✨</span>
          </DialogTitle>
          <DialogDescription>
            Drafts from the lesson body — verify every answer key before saving.
          </DialogDescription>
        </DialogHeader>

        {!draft ? (
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="aiq-count">Questions</Label>
                <Input
                  id="aiq-count"
                  type="number"
                  min="1"
                  max="20"
                  value={questionCount}
                  onChange={(event) => setQuestionCount(Number(event.target.value) || 5)}
                />
              </div>
              <div>
                <Label htmlFor="aiq-difficulty">Difficulty</Label>
                <select
                  id="aiq-difficulty"
                  className="h-9 w-full rounded-lg border bg-input/30 px-3 text-sm"
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}
                >
                  <option value="easy">Easy</option>
                  <option value="mixed">Mixed</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <fieldset className="text-xs">
                <legend className="text-sm font-medium">Types</legend>
                {(['multiple_choice', 'true_false', 'short_answer'] as const).map((type) => (
                  <label key={type} className="mt-1 flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={types.includes(type)}
                      onChange={(event) =>
                        setTypes((previous) =>
                          event.target.checked
                            ? [...previous, type]
                            : previous.filter((candidate) => candidate !== type),
                        )
                      }
                    />
                    {type === 'multiple_choice'
                      ? 'Multiple choice'
                      : type === 'true_false'
                        ? 'True/False'
                        : 'Short answer'}
                  </label>
                ))}
              </fieldset>
            </div>
            <Button
              className="self-end"
              disabled={generate.isPending || types.length === 0}
              onClick={() => {
                setDraft(null)
                generate.mutate([])
              }}
            >
              {generate.isPending ? <Spinner className="size-4" /> : <span aria-hidden>✨</span>}
              Generate Quiz
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <ol className="flex list-decimal flex-col gap-3 pl-5">
              {draft.questions.map((question, index) => (
                <li key={index} className="rounded-lg border p-3">
                  <div className="flex items-start gap-2">
                    <Textarea
                      className="min-w-0 flex-1"
                      rows={2}
                      value={question.questionText}
                      aria-label={`Question ${index + 1}`}
                      onChange={(event) =>
                        patchQuestion(index, { questionText: event.target.value })
                      }
                    />
                    <span className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Regenerate question"
                        onClick={() => {
                          setDraft((previous) =>
                            previous
                              ? {
                                  ...previous,
                                  questions: previous.questions.filter(
                                    (_, candidate) => candidate !== index,
                                  ),
                                }
                              : previous,
                          )
                          generate.mutate(
                            draft.questions
                              .map((candidate) => candidate.questionText)
                              .filter((text) => text.length > 0),
                          )
                        }}
                      >
                        ↻
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Delete question"
                        onClick={() => removeQuestion(index)}
                      >
                        🗑
                      </Button>
                    </span>
                  </div>
                  {question.questionType !== 'short_answer' ? (
                    <ul className="mt-2 flex flex-col gap-1">
                      {question.options.map((option, optionIndex) => (
                        <li key={optionIndex} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`aiq-correct-${index}`}
                            checked={option.isCorrect}
                            aria-label={`Mark option ${optionIndex + 1} correct`}
                            onChange={() =>
                              patchQuestion(index, {
                                options: question.options.map((candidate, candidateIndex) => ({
                                  ...candidate,
                                  isCorrect: candidateIndex === optionIndex,
                                })),
                              })
                            }
                          />
                          <Input
                            className="h-8"
                            value={option.optionText}
                            onChange={(event) =>
                              patchQuestion(index, {
                                options: question.options.map((candidate, candidateIndex) =>
                                  candidateIndex === optionIndex
                                    ? { ...candidate, optionText: event.target.value }
                                    : candidate,
                                ),
                              })
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-2">
                      <Label htmlFor={`aiq-answer-${index}`}>Expected answer</Label>
                      <Input
                        id={`aiq-answer-${index}`}
                        value={question.correctAnswer ?? ''}
                        onChange={(event) =>
                          patchQuestion(index, { correctAnswer: event.target.value })
                        }
                      />
                    </div>
                  )}
                </li>
              ))}
            </ol>

            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ AI can make mistakes — verify each answer key before saving.
            </p>

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                  Discard
                </Button>
              </div>
              <Button
                disabled={draft.questions.length === 0}
                onClick={() => {
                  onAccept(draft.questions)
                  onOpenChange(false)
                }}
              >
                Open in Quiz Builder
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
