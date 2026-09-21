import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
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
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import type { AiOutlineResult } from '../courses.types'

/**
 * S-2.11 AI Course Generator: prompt + parameters → editable outline draft
 * (✨ labeled) → explicit "Create Course" acceptance into a draft course.
 * Generation is persisted as an ai_generation_job; nothing is applied
 * silently. Partial failures keep accepted modules and offer per-module retry.
 */
export function AiCourseGeneratorModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [prompt, setPrompt] = useState('')
  const [audience, setAudience] = useState('Adult learners')
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner')
  const [moduleCount, setModuleCount] = useState(4)
  const [lessonsPerModule, setLessonsPerModule] = useState(3)
  const [language, setLanguage] = useState('English')
  const [includeQuizSeeds, setIncludeQuizSeeds] = useState(true)
  const [draft, setDraft] = useState<AiOutlineResult | null>(null)
  const [deselected, setDeselected] = useState<Set<string>>(new Set())
  const [confirmClose, setConfirmClose] = useState(false)

  const generate = useMutation({
    mutationFn: async () => {
      const { generateCourseOutline } = await import('../server/all')
      return generateCourseOutline({
        data: {
          prompt,
          audience,
          level,
          moduleCount,
          lessonsPerModule,
          language,
          includeQuizSeeds,
        },
      })
    },
    onSuccess: (result) => {
      setDraft(result)
      setDeselected(new Set())
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Generation failed'),
  })

  const regenerateModule = useMutation({
    mutationFn: async (moduleTitle: string) => {
      const { regenerateOutlineModule } = await import('../server/all')
      return regenerateOutlineModule({
        data: {
          request: {
            prompt,
            audience,
            level,
            moduleCount,
            lessonsPerModule,
            language,
            includeQuizSeeds,
          },
          moduleTitle,
        },
      })
    },
    onSuccess: (result) => {
      if (draft) setDraft({ ...draft, modules: result.modules })
      toast.success('Module regenerated.')
    },
  })

  const expandModule = useMutation({
    mutationFn: async (moduleTitle: string) => {
      const { expandOutlineModule } = await import('../server/all')
      return expandOutlineModule({
        data: {
          moduleTitle,
          count: 3,
          request: {
            prompt,
            audience,
            level,
            moduleCount,
            lessonsPerModule,
            language,
            includeQuizSeeds,
          },
        },
      })
    },
    onSuccess: (result) => {
      if (draft) setDraft({ ...draft, modules: [...draft.modules, ...result.modules] })
      toast.success('Module expanded.')
    },
  })

  const createCourse = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('Generate an outline first')
      const { createCourseDraft, createModule, createLesson } = await import('../server/all')
      const kept = draft.modules.filter((module) => !deselected.has(module.title))
      const course = await createCourseDraft({
        data: {
          title: draft.title,
          description: draft.description.slice(0, 500),
          examTypeId: await resolveFirstExamType(),
        },
      })
      // Create modules/lessons through the curriculum API so ordering and
      // validation stay in one place.
      for (const module of kept) {
        const created = await createModule({
          data: { coursePublicId: course.coursePublicId, title: module.title },
        })
        const moduleId = created.modules.find(
          (candidate) => candidate.title === module.title,
        )?.publicId
        if (!moduleId) continue
        for (const lesson of module.lessons) {
          await createLesson({ data: { modulePublicId: moduleId, title: lesson.title } })
        }
      }
      return course.coursePublicId
    },
    onSuccess: (coursePublicId) => {
      void queryClient.invalidateQueries({ queryKey: ['courses'] })
      toast.success('Draft course created from the AI outline — review before publishing.')
      onOpenChange(false)
      void navigate({ to: '/courses/$courseId', params: { courseId: coursePublicId } })
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Import failed'),
  })

  async function resolveFirstExamType(): Promise<number> {
    const { getCourseFormReference } = await import('../server/all')
    const reference = await getCourseFormReference()
    const first = reference.examTypes.at(0)
    if (!first) throw new Error('No categories configured — ask an admin to add one.')
    return first.id
  }

  const generating = generate.isPending

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next && generating ? setConfirmClose(true) : onOpenChange(next))}
    >
      <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            AI Course Generator <span aria-hidden>✨</span>
          </DialogTitle>
          <DialogDescription>
            Everything generated is an editable draft — you accept it explicitly.
          </DialogDescription>
        </DialogHeader>

        {!draft ? (
          <div className="flex flex-col gap-3">
            <Label htmlFor="ai-prompt">Describe the course (10–2,000 characters)</Label>
            <Textarea
              id="ai-prompt"
              value={prompt}
              minLength={10}
              maxLength={2000}
              rows={4}
              placeholder="Create a 12-week TOEFL preparation course for intermediate English learners, with weekly quizzes and a final mock test."
              onChange={(event) => setPrompt(event.target.value)}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="ai-audience">Audience</Label>
                <Input
                  id="ai-audience"
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ai-level">Level</Label>
                <select
                  id="ai-level"
                  className="h-9 w-full rounded-lg border bg-input/30 px-3 text-sm"
                  value={level}
                  onChange={(event) => setLevel(event.target.value as typeof level)}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div>
                <Label htmlFor="ai-language">Language</Label>
                <Input
                  id="ai-language"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ai-modules">Modules</Label>
                <Input
                  id="ai-modules"
                  type="number"
                  min="1"
                  max="12"
                  value={moduleCount}
                  onChange={(event) => setModuleCount(Number(event.target.value) || 1)}
                />
              </div>
              <div>
                <Label htmlFor="ai-lessons">Lessons each</Label>
                <Input
                  id="ai-lessons"
                  type="number"
                  min="1"
                  max="8"
                  value={lessonsPerModule}
                  onChange={(event) => setLessonsPerModule(Number(event.target.value) || 1)}
                />
              </div>
              <label className="mt-6 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeQuizSeeds}
                  onChange={(event) => setIncludeQuizSeeds(event.target.checked)}
                />
                Include quiz seeds
              </label>
            </div>
            <Button
              className="self-end"
              disabled={generating || prompt.trim().length < 10}
              onClick={() => generate.mutate()}
            >
              {generating ? <Spinner className="size-4" /> : <span aria-hidden>✨</span>}
              Generate Outline
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="font-semibold">{draft.title}</p>
              <p className="text-sm text-muted-foreground">{draft.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                ✨ AI draft via {draft.provider} — every item is editable before importing.
              </p>
            </div>

            <ul className="flex flex-col gap-2" aria-busy={regenerateModule.isPending}>
              {draft.modules.map((module, moduleIndex) => (
                <li key={`${module.title}-${moduleIndex}`} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!deselected.has(module.title)}
                      onChange={(event) =>
                        setDeselected((previous) => {
                          const next = new Set(previous)
                          if (event.target.checked) next.delete(module.title)
                          else next.add(module.title)
                          return next
                        })
                      }
                      aria-label={`Include ${module.title}`}
                    />
                    <span className="flex-1 font-medium">{module.title}</span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Regenerate ${module.title}`}
                      onClick={() => regenerateModule.mutate(module.title)}
                    >
                      ↻
                    </Button>
                  </div>
                  <ul className="mt-1 ml-6 flex flex-col text-sm text-muted-foreground">
                    {module.lessons.map((lesson, lessonIndex) => (
                      <li key={`${lesson.title}-${lessonIndex}`}>
                        {deselected.has(module.title) ? '☐' : '☑'} {lesson.title}{' '}
                        <span className="text-xs">
                          ({lesson.format}, ~{lesson.durationMinutes} min)
                          {lesson.needsContent ? ' ⚠️ needs content' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => expandModule.mutate(module.title)}
                    disabled={expandModule.isPending}
                  >
                    + Expand module with 3 more lessons
                  </Button>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    generate.mutate()
                  }}
                >
                  ↻ Regenerate All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setDeselected(new Set(draft.modules.map((module) => module.title)))
                  }
                >
                  Deselect All
                </Button>
              </div>
              <Button disabled={createCourse.isPending} onClick={() => createCourse.mutate()}>
                {createCourse.isPending ? <Spinner className="size-4" /> : null}
                Create Course
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Cancel generation?"
        body="A generation is in progress or a draft is unaccepted. Closing now discards the partial draft."
        confirmLabel="Discard draft"
        destructive
        onConfirm={() => {
          setConfirmClose(false)
          onOpenChange(false)
        }}
      />
    </Dialog>
  )
}
