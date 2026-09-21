import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
import { quizQueryOptions, courseQueryKeys } from '../hooks/courses.queries'
import { validateQuizQuestions, trueFalseOptions } from '../courses.quiz-validation'
import type { QuizSaveInput } from '../schemas/courses.learning.schema'
import type { QuizDTO, QuizQuestionDTO } from '../courses.types'

/**
 * S-2.8 Quiz Builder: settings (passing score / time limit / attempts),
 * per-question authoring (MC/TF/short answer, exactly-one-correct rule),
 * reorder, duplicate, and a student-view preview overlay.
 */
export function QuizBuilderModal({
  lessonPublicId,
  initialDraft,
  onClose,
  onOpenAiQuiz,
}: {
  lessonPublicId: string
  /** Draft handed off from the AI Quiz Generator (S-2.16), not yet persisted. */
  initialDraft?: Array<{
    questionType: 'multiple_choice' | 'true_false' | 'short_answer'
    questionText: string
    options: Array<{ optionText: string; isCorrect: boolean }>
    correctAnswer: string | null
    explanation: string | null
    points: number
  }> | null
  onClose: () => void
  onOpenAiQuiz: () => void
}) {
  const queryClient = useQueryClient()
  const quiz = useQuery(quizQueryOptions(lessonPublicId))

  const [title, setTitle] = useState('')
  const [passingScore, setPassingScore] = useState(70)
  const [timeLimit, setTimeLimit] = useState('')
  const [maxAttempts, setMaxAttempts] = useState('')
  const [questions, setQuestions] = useState<QuizQuestionDTO[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (hydrated) return
    if (initialDraft && initialDraft.length > 0) {
      setTitle('Lesson Quiz')
      setQuestions(
        initialDraft.map((question) => ({
          publicId: null,
          questionType: question.questionType,
          questionText: question.questionText,
          points: question.points,
          explanation: question.explanation,
          options: question.options.map((option) => ({
            publicId: null,
            optionText: option.optionText,
            isCorrect: option.isCorrect,
          })),
          correctAnswer: question.correctAnswer,
        })),
      )
      setHydrated(true)
      return
    }
    if (!quiz.data) return
    const data: QuizDTO = quiz.data
    setTitle(data.title)
    setPassingScore(data.passingScorePercent)
    setTimeLimit(data.timeLimitMinutes?.toString() ?? '')
    setMaxAttempts(data.maxAttempts?.toString() ?? '')
    setQuestions(
      data.questions.length > 0
        ? data.questions
        : [
            {
              publicId: null,
              questionType: 'multiple_choice',
              questionText: '',
              points: 10,
              explanation: null,
              options: [
                { publicId: null, optionText: '', isCorrect: true },
                { publicId: null, optionText: '', isCorrect: false },
              ],
              correctAnswer: null,
            },
          ],
    )
    setHydrated(true)
  }, [hydrated, quiz.data])

  const save = useMutation({
    mutationFn: async (input: QuizSaveInput) => {
      const { saveQuiz } = await import('../server/all')
      return saveQuiz({ data: input })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: courseQueryKeys.quiz(lessonPublicId) })
      void queryClient.invalidateQueries({ queryKey: courseQueryKeys.curriculum('') })
      toast.success('Quiz saved.')
      onClose()
    },
    onError: (cause) => {
      setError(cause instanceof Error ? cause.message : 'Save failed')
      toast.error(
        cause instanceof Error ? cause.message.replace(/^QUIZ_INVALID:\s*/, '') : 'Save failed',
      )
    },
  })

  const patchQuestion = (index: number, patch: Partial<QuizQuestionDTO>) =>
    setQuestions((previous) =>
      previous.map((question, candidate) =>
        candidate === index ? { ...question, ...patch } : question,
      ),
    )

  const buildPayload = (): QuizSaveInput => ({
    lessonPublicId,
    title: title.trim() || 'Lesson Quiz',
    passingScorePercent: passingScore,
    timeLimitMinutes: timeLimit ? Number(timeLimit) : null,
    maxAttempts: maxAttempts ? Number(maxAttempts) : null,
    isPublished: false,
    questions: questions.map((question) => ({
      publicId: question.publicId ?? undefined,
      questionType: question.questionType,
      questionText: question.questionText,
      points: question.points,
      explanation: question.explanation ?? undefined,
      options:
        question.questionType === 'short_answer'
          ? []
          : question.options.map((option) => ({
              optionText: option.optionText,
              isCorrect: option.isCorrect,
            })),
      correctAnswer:
        question.questionType === 'short_answer' ? (question.correctAnswer ?? '') : undefined,
    })),
  })

  const violations = validateQuizQuestions(
    questions.map((question) => ({
      questionType: question.questionType,
      questionText: question.questionText,
      options: question.options.map((option) => ({
        optionText: option.optionText,
        isCorrect: option.isCorrect,
      })),
      correctAnswer: question.correctAnswer ?? undefined,
    })),
  )

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Quiz Builder</DialogTitle>
          <DialogDescription>Graded checks attach to this lesson.</DialogDescription>
        </DialogHeader>

        {quiz.isPending ? (
          <Spinner className="mx-auto my-8" />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <Label htmlFor="quiz-title">Quiz title</Label>
                <Input
                  id="quiz-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="quiz-pass">Passing Score %</Label>
                <Input
                  id="quiz-pass"
                  type="number"
                  min="1"
                  max="100"
                  value={passingScore}
                  onChange={(event) => setPassingScore(Number(event.target.value) || 70)}
                />
              </div>
              <div>
                <Label htmlFor="quiz-time">Time Limit (min)</Label>
                <Input
                  id="quiz-time"
                  type="number"
                  min="1"
                  value={timeLimit}
                  onChange={(event) => setTimeLimit(event.target.value)}
                  placeholder="—"
                />
              </div>
              <div>
                <Label htmlFor="quiz-attempts">Attempts</Label>
                <Input
                  id="quiz-attempts"
                  type="number"
                  min="1"
                  value={maxAttempts}
                  onChange={(event) => setMaxAttempts(event.target.value)}
                  placeholder="—"
                />
              </div>
            </div>

            {questions.map((question, questionIndex) => (
              <fieldset
                key={question.publicId ?? `new-${questionIndex}`}
                className="rounded-xl border p-3"
              >
                <legend className="px-1 text-sm font-medium">Question {questionIndex + 1}</legend>
                <div className="flex flex-wrap items-center gap-2">
                  {(['multiple_choice', 'true_false', 'short_answer'] as const).map((type) => (
                    <label key={type} className="flex items-center gap-1 text-xs">
                      <input
                        type="radio"
                        name={`qtype-${questionIndex}`}
                        checked={question.questionType === type}
                        onChange={() =>
                          patchQuestion(index2(questionIndex), {
                            questionType: type,
                            options:
                              type === 'true_false'
                                ? trueFalseOptions().map((option) => ({
                                    publicId: null,
                                    ...option,
                                  }))
                                : type === 'short_answer'
                                  ? []
                                  : [
                                      { publicId: null, optionText: '', isCorrect: true },
                                      { publicId: null, optionText: '', isCorrect: false },
                                    ],
                          })
                        }
                      />
                      {type === 'multiple_choice'
                        ? 'Multiple Choice'
                        : type === 'true_false'
                          ? 'True/False'
                          : 'Short Answer'}
                    </label>
                  ))}
                  <span className="ml-auto flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Duplicate question"
                      onClick={() =>
                        setQuestions((previous) => {
                          const next = [...previous]
                          next.splice(questionIndex + 1, 0, {
                            ...question,
                            publicId: null,
                            options: question.options.map((option) => ({
                              ...option,
                              publicId: null,
                            })),
                          })
                          return next
                        })
                      }
                    >
                      ⧉
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Delete question"
                      onClick={() =>
                        setQuestions((previous) =>
                          previous.filter((_, candidate) => candidate !== questionIndex),
                        )
                      }
                    >
                      🗑
                    </Button>
                  </span>
                </div>

                <Textarea
                  className="mt-2"
                  rows={2}
                  aria-label={`Question ${questionIndex + 1} prompt`}
                  placeholder="What is the main idea…?"
                  value={question.questionText}
                  onChange={(event) =>
                    patchQuestion(index2(questionIndex), { questionText: event.target.value })
                  }
                />

                {question.questionType === 'short_answer' ? (
                  <div className="mt-2">
                    <Label htmlFor={`answer-${questionIndex}`}>Expected answer</Label>
                    <Input
                      id={`answer-${questionIndex}`}
                      value={question.correctAnswer ?? ''}
                      onChange={(event) =>
                        patchQuestion(index2(questionIndex), { correctAnswer: event.target.value })
                      }
                    />
                  </div>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1">
                    {question.options.map((option, optionIndex) => (
                      <li key={optionIndex} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${questionIndex}`}
                          checked={option.isCorrect}
                          aria-label={`Mark option ${optionIndex + 1} correct`}
                          onChange={() =>
                            patchQuestion(index2(questionIndex), {
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
                          aria-label={`Option ${optionIndex + 1} text`}
                          onChange={(event) =>
                            patchQuestion(index2(questionIndex), {
                              options: question.options.map((candidate, candidateIndex) =>
                                candidateIndex === optionIndex
                                  ? { ...candidate, optionText: event.target.value }
                                  : candidate,
                              ),
                            })
                          }
                        />
                        {question.options.length > 2 ? (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Remove option ${optionIndex + 1}`}
                            onClick={() =>
                              patchQuestion(index2(questionIndex), {
                                options: question.options.filter(
                                  (_, candidateIndex) => candidateIndex !== optionIndex,
                                ),
                              })
                            }
                          >
                            ✕
                          </Button>
                        ) : null}
                      </li>
                    ))}
                    {question.questionType === 'multiple_choice' ? (
                      <li>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() =>
                            patchQuestion(index2(questionIndex), {
                              options: [
                                ...question.options,
                                { publicId: null, optionText: '', isCorrect: false },
                              ],
                            })
                          }
                        >
                          + Add Option
                        </Button>
                      </li>
                    ) : null}
                  </ul>
                )}

                <div className="mt-2 grid gap-2 sm:grid-cols-[100px_1fr]">
                  <div>
                    <Label htmlFor={`points-${questionIndex}`}>Points</Label>
                    <Input
                      id={`points-${questionIndex}`}
                      type="number"
                      min="1"
                      max="100"
                      value={question.points}
                      onChange={(event) =>
                        patchQuestion(index2(questionIndex), {
                          points: Number(event.target.value) || 10,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`explanation-${questionIndex}`}>
                      Explanation (shown after answer)
                    </Label>
                    <Input
                      id={`explanation-${questionIndex}`}
                      value={question.explanation ?? ''}
                      onChange={(event) =>
                        patchQuestion(index2(questionIndex), { explanation: event.target.value })
                      }
                    />
                  </div>
                </div>
              </fieldset>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setQuestions((previous) => [
                      ...previous,
                      {
                        publicId: null,
                        questionType: 'multiple_choice',
                        questionText: '',
                        points: 10,
                        explanation: null,
                        options: [
                          { publicId: null, optionText: '', isCorrect: true },
                          { publicId: null, optionText: '', isCorrect: false },
                        ],
                        correctAnswer: null,
                      },
                    ])
                  }
                >
                  + Add Question
                </Button>
                <Button variant="outline" size="sm" onClick={onOpenAiQuiz}>
                  ✨ AI Draft
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewOpen(true)}
                  disabled={questions.length === 0}
                >
                  Preview Quiz
                </Button>
                <Button
                  disabled={save.isPending || violations.length > 0 || questions.length === 0}
                  onClick={() => save.mutate(buildPayload())}
                >
                  {save.isPending ? <Spinner className="size-4" /> : null}
                  Save Quiz
                </Button>
              </div>
            </div>

            {violations.length > 0 ? (
              <p className="text-destructive text-sm" role="alert">
                {violations[0]?.message}
                {violations.length > 1 ? ` (+${violations.length - 1} more)` : ''}
              </p>
            ) : null}
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </DialogContent>

      {previewOpen ? (
        <QuizPreview
          title={title}
          questions={questions}
          passingScore={passingScore}
          timeLimit={timeLimit}
          maxAttempts={maxAttempts}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </Dialog>
  )
}

function index2(index: number): number {
  return index
}

/** Read-only student-view overlay (spec: Preview Quiz). */
function QuizPreview({
  title,
  questions,
  passingScore,
  timeLimit,
  maxAttempts,
  onClose,
}: {
  title: string
  questions: QuizQuestionDTO[]
  passingScore: number
  timeLimit: string
  maxAttempts: string
  onClose: () => void
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title || 'Lesson Quiz'}</DialogTitle>
          <DialogDescription>
            Student view · Pass at {passingScore}%{timeLimit ? ` · ${timeLimit} min` : ''}
            {maxAttempts ? ` · ${maxAttempts} attempts` : ''}
          </DialogDescription>
        </DialogHeader>
        <ol className="flex list-decimal flex-col gap-4 pl-5">
          {questions.map((question, questionIndex) => (
            <li key={questionIndex} className="text-sm">
              <p className="font-medium">
                {question.questionText || `Question ${questionIndex + 1}`}{' '}
                <span className="text-xs text-muted-foreground">({question.points} pts)</span>
              </p>
              {question.questionType === 'short_answer' ? (
                <Input className="mt-1" placeholder="Type your answer…" disabled />
              ) : (
                <ul className="mt-1 flex flex-col gap-1">
                  {question.options.map((option, optionIndex) => (
                    <li key={optionIndex} className="flex items-center gap-2">
                      <input type="radio" disabled name={`preview-${questionIndex}`} />
                      <span>{option.optionText || `Option ${optionIndex + 1}`}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  )
}
