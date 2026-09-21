import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { Spinner } from '#/components/ui/spinner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { courseQueryKeys, unlockRulesQueryOptions } from '../hooks/courses.queries'
import { buildLockMessage } from '../courses.unlock-cycle'
import type { UnlockCondition } from '../schemas/courses.learning.schema'

/**
 * S-2.15 Prerequisites & Unlock Rules slide-over. Requirements reference any
 * lesson/quiz in the same course; circular chains are blocked with the
 * offending cycle highlighted; lock message is auto-generated but editable.
 */
export function UnlockRulesSheet({
  lessonPublicId,
  onOpenChange,
}: {
  lessonPublicId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const rules = useQuery({
    ...unlockRulesQueryOptions(lessonPublicId ?? ''),
    enabled: Boolean(lessonPublicId),
  })

  const [enabled, setEnabled] = useState(false)
  const [lockBehavior, setLockBehavior] = useState<'hidden' | 'visible_locked'>('visible_locked')
  const [customMessage, setCustomMessage] = useState('')
  const [requirements, setRequirements] = useState<
    Array<{
      requiredLessonPublicId: string
      condition: UnlockCondition
      thresholdPercent: number | null
    }>
  >([])
  const [cycle, setCycle] = useState<string[] | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (hydrated || !rules.data || !lessonPublicId) return
    setEnabled(rules.data.enabled)
    setLockBehavior(rules.data.lockBehavior)
    setCustomMessage(rules.data.customMessage ?? '')
    setRequirements(
      rules.data.rules.map((rule) => ({
        requiredLessonPublicId: rule.requiredLessonPublicId,
        condition: rule.condition,
        thresholdPercent: rule.thresholdPercent,
      })),
    )
    setHydrated(true)
  }, [hydrated, rules.data, lessonPublicId])

  const save = useMutation({
    mutationFn: async () => {
      const { saveUnlockRules } = await import('../server/all')
      return saveUnlockRules({
        data: {
          lessonPublicId: lessonPublicId!,
          enabled,
          requirements,
          lockBehavior,
          customMessage: customMessage.trim() || undefined,
        },
      })
    },
    onSuccess: (result) => {
      if (result.ok) {
        setCycle(null)
        void queryClient.invalidateQueries({
          queryKey: courseQueryKeys.unlockRules(lessonPublicId ?? ''),
        })
        void queryClient.invalidateQueries({ queryKey: courseQueryKeys.curriculum('') })
        toast.success('Unlock rules saved.')
        onOpenChange(false)
      } else {
        setCycle(result.cycleLessonPublicIds)
        toast.error('Circular dependency detected — fix the highlighted lessons.')
      }
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Save failed'),
  })

  const autoMessage = buildLockMessage(
    requirements.map((requirement) => {
      const candidate = rules.data?.candidateRequirements.find(
        (option) => option.lessonPublicId === requirement.requiredLessonPublicId,
      )
      return {
        lessonTitle: candidate?.lessonTitle ?? 'the required lesson',
        condition: requirement.condition,
        thresholdPercent: requirement.thresholdPercent,
      }
    }),
  )
  const previewMessage = customMessage.trim() || autoMessage

  return (
    <Sheet open={Boolean(lessonPublicId)} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Unlock Rules — {rules.data?.lessonTitle ?? ''}</SheetTitle>
          <SheetDescription>
            Students must satisfy the requirements before this lesson unlocks.
          </SheetDescription>
        </SheetHeader>

        {rules.isPending ? (
          <Spinner className="mx-auto my-8" />
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              Require lessons before this one
            </label>

            {enabled ? (
              <>
                <ul className="flex flex-col gap-2">
                  {requirements.map((requirement, index) => {
                    const candidate = rules.data?.candidateRequirements.find(
                      (option) => option.lessonPublicId === requirement.requiredLessonPublicId,
                    )
                    const inCycle = cycle?.includes(requirement.requiredLessonPublicId) ?? false
                    return (
                      <li
                        key={`${requirement.requiredLessonPublicId}-${index}`}
                        className={
                          'flex flex-col gap-2 rounded-lg border p-2' +
                          (inCycle ? ' border-destructive' : '')
                        }
                      >
                        <div className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {candidate?.lessonTitle ?? 'Lesson'}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Remove requirement"
                            onClick={() =>
                              setRequirements((previous) =>
                                previous.filter((_, candidateIndex) => candidateIndex !== index),
                              )
                            }
                          >
                            ✕
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`cond-${index}`} className="text-xs">
                            Must
                          </Label>
                          <select
                            id={`cond-${index}`}
                            className="h-8 flex-1 rounded border bg-input/30 px-2 text-sm"
                            value={requirement.condition}
                            onChange={(event) =>
                              setRequirements((previous) =>
                                previous.map((candidate2, candidateIndex) =>
                                  candidateIndex === index
                                    ? {
                                        ...candidate2,
                                        condition: event.target.value as UnlockCondition,
                                      }
                                    : candidate2,
                                ),
                              )
                            }
                          >
                            <option value="viewed">View</option>
                            <option value="completed">Complete</option>
                            <option value="quiz_score" disabled={!candidate?.hasQuiz}>
                              Quiz score ≥ threshold{!candidate?.hasQuiz ? ' (no quiz)' : ''}
                            </option>
                          </select>
                          {requirement.condition === 'quiz_score' ? (
                            <Input
                              type="number"
                              min="1"
                              max="100"
                              className="h-8 w-20"
                              aria-label="Score threshold percent"
                              value={requirement.thresholdPercent ?? ''}
                              onChange={(event) =>
                                setRequirements((previous) =>
                                  previous.map((candidate2, candidateIndex) =>
                                    candidateIndex === index
                                      ? {
                                          ...candidate2,
                                          thresholdPercent: event.target.value
                                            ? Number(event.target.value)
                                            : null,
                                        }
                                      : candidate2,
                                  ),
                                )
                              }
                            />
                          ) : null}
                        </div>
                        {inCycle ? (
                          <p className="text-destructive text-xs" role="alert">
                            Part of a circular dependency chain.
                          </p>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>

                <select
                  aria-label="Add requirement from any lesson in this course"
                  className="h-9 rounded-lg border bg-input/30 px-3 text-sm"
                  value=""
                  onChange={(event) => {
                    const publicId = event.target.value
                    if (!publicId) return
                    setRequirements((previous) => [
                      ...previous,
                      {
                        requiredLessonPublicId: publicId,
                        condition: 'viewed',
                        thresholdPercent: null,
                      },
                    ])
                    event.target.value = ''
                  }}
                >
                  <option value="">+ Add requirement from any lesson…</option>
                  {rules.data?.candidateRequirements
                    .filter(
                      (option) =>
                        !requirements.some(
                          (requirement) =>
                            requirement.requiredLessonPublicId === option.lessonPublicId,
                        ),
                    )
                    .map((option) => (
                      <option key={option.lessonPublicId} value={option.lessonPublicId}>
                        {option.lessonTitle}
                        {option.hasQuiz ? ' (has quiz)' : ''}
                      </option>
                    ))}
                </select>

                <fieldset>
                  <legend className="text-sm font-medium">Lock behavior</legend>
                  <label className="mt-1 flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="lockBehavior"
                      checked={lockBehavior === 'hidden'}
                      onChange={() => setLockBehavior('hidden')}
                    />
                    Hidden until met
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="lockBehavior"
                      checked={lockBehavior === 'visible_locked'}
                      onChange={() => setLockBehavior('visible_locked')}
                    />
                    Visible but locked 🔒
                  </label>
                </fieldset>

                <div>
                  <Label htmlFor="lock-message">Student-facing lock message</Label>
                  <Textarea
                    id="lock-message"
                    rows={2}
                    value={customMessage}
                    placeholder={autoMessage}
                    onChange={(event) => setCustomMessage(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use the auto-generated message.
                  </p>
                </div>

                <div className="rounded-lg bg-muted/40 p-3 text-sm">
                  <p className="font-medium">🔎 Student preview</p>
                  <p className="text-muted-foreground">
                    {previewMessage || 'This lesson is freely accessible.'}
                  </p>
                </div>

                <p className="text-xs text-muted-foreground">
                  ⚠️ Circular dependency check:{' '}
                  {cycle ? 'chain detected — fix before saving' : 'none detected'}
                </p>
              </>
            ) : null}

            <Button className="self-end" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Spinner className="size-4" /> : null}
              Save Rules
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
