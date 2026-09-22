import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import { Input } from '#/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Spinner } from '#/components/ui/spinner'
import { toast } from '#/components/common/toast'
import { curriculumQueryOptions, courseQueryKeys } from '../hooks/courses.queries'
import { getCourseCatalog } from '../server/all'
import {
  duplicateLessonTitle,
  resolveDuplicateOrder,
  buildContentPayload,
  DUPLICATE_STARTS_DRAFT_NOTE,
} from '../courses.duplicate-lesson'
import type { DuplicatePositionMode } from '../courses.duplicate-lesson'

/**
 * S-7.7 Duplicate Lesson Modal (spec 09): clone a lesson into another
 * course/module, preserving content and (optionally) a detached quiz copy.
 *
 * Spec behaviors: source pre-filled; target defaults to the most recently
 * edited course; inline "+ New module"; position end-of-module or after a
 * chosen lesson; name conflicts pre-shown as "<title> (copy)"; media is
 * referenced (asset link copied), never re-uploaded; unlock rules are
 * never copied; the copy starts in Draft — the review flow cannot be
 * bypassed, so there is deliberately no "publish immediately" override.
 */
export function DuplicateLessonModal({
  lessonPublicId,
  lessonTitle,
  sourceCoursePublicId,
  onClose,
}: {
  lessonPublicId: string | null
  lessonTitle: string
  sourceCoursePublicId: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const catalog = useQuery({
    queryKey: ['courses', 'duplicate-lesson-targets'],
    queryFn: () =>
      getCourseCatalog({ data: { status: 'all', type: 'all', sort: 'recent', page: 0 } }),
    enabled: Boolean(lessonPublicId),
  })

  const sourceCurriculum = useQuery({
    ...curriculumQueryOptions(sourceCoursePublicId),
    enabled: Boolean(lessonPublicId),
  })

  const [targetCourseId, setTargetCourseId] = useState('')
  const [targetModuleId, setTargetModuleId] = useState('')
  const [positionMode, setPositionMode] = useState<DuplicatePositionMode>('end')
  const [afterLessonId, setAfterLessonId] = useState('')
  const [includeContent, setIncludeContent] = useState(true)
  const [includeQuiz, setIncludeQuiz] = useState(true)
  const [newModuleTitle, setNewModuleTitle] = useState('')
  const [creatingModule, setCreatingModule] = useState(false)

  // Spec: default the target to the most recently edited editable course.
  useEffect(() => {
    if (!lessonPublicId) return
    if (targetCourseId) return
    const firstEditable = (catalog.data?.items ?? []).find(
      (course) => course.publicId !== sourceCoursePublicId,
    )
    if (firstEditable) setTargetCourseId(firstEditable.publicId)
  }, [lessonPublicId, targetCourseId, catalog.data, sourceCoursePublicId])

  const targetCurriculum = useQuery({
    ...curriculumQueryOptions(targetCourseId),
    enabled: Boolean(targetCourseId),
  })

  const sourceLesson = useMemo(
    () =>
      sourceCurriculum.data?.modules
        .flatMap((module) => module.lessons)
        .find((lesson) => lesson.publicId === lessonPublicId) ?? null,
    [sourceCurriculum.data, lessonPublicId],
  )

  const targetModule = targetCurriculum.data?.modules.find(
    (module) => module.publicId === targetModuleId,
  )
  const existingTitles = (targetModule?.lessons ?? []).map((lesson) => lesson.title)
  const finalTitle = duplicateLessonTitle(lessonTitle, existingTitles)
  const conflict = finalTitle !== `${lessonTitle.trim()} (copy)`

  const targetCourse = (catalog.data?.items ?? []).find(
    (course) => course.publicId === targetCourseId,
  )

  const contentCopyable = Boolean(sourceLesson && (sourceLesson.hasBody || sourceLesson.videoUrl))
  const quizCopyable = Boolean(sourceLesson?.hasQuiz)

  useEffect(() => {
    if (!contentCopyable) setIncludeContent(false)
  }, [contentCopyable])
  useEffect(() => {
    if (!quizCopyable) setIncludeQuiz(false)
  }, [quizCopyable])

  const duplicate = useMutation({
    mutationFn: async () => {
      if (!lessonPublicId || !targetCourseId || !targetModuleId) {
        throw new Error('Pick a target course and module')
      }
      const {
        createLesson,
        saveCurriculumOrder,
        saveLesson,
        getLessonForEdit,
        getQuizForLesson,
        saveQuiz,
        createModule,
      } = await import('../server/all')

      let modulePublicId = targetModuleId
      if (creatingModule) {
        const created = await createModule({
          data: { coursePublicId: targetCourseId, title: newModuleTitle.trim() },
        })
        const createdModule = created.modules.find(
          (module) => module.title === newModuleTitle.trim(),
        )
        if (!createdModule) throw new Error('Module could not be created. Retry?')
        modulePublicId = createdModule.publicId
      }

      // Create the draft shell with the conflict-resolved title.
      const created = await createLesson({ data: { modulePublicId, title: finalTitle } })
      const targetModuleResult = created.modules.find(
        (module) => module.publicId === modulePublicId,
      )
      const shellLesson = targetModuleResult?.lessons.find((lesson) => lesson.title === finalTitle)
      if (!shellLesson) throw new Error('Lesson could not be created. Retry?')

      // Content: copy what the user asked for; media stays referenced.
      if (includeContent && sourceLesson) {
        const edit = await getLessonForEdit({ data: { lessonPublicId } })
        const payload = buildContentPayload({ content: true, quiz: includeQuiz }, edit)
        if (payload) {
          await saveLesson({
            data: {
              lessonPublicId: shellLesson.publicId,
              title: shellLesson.title,
              body: payload.body,
              contentType: payload.contentType,
              videoUrl: payload.videoUrl,
              durationMinutes: payload.durationMinutes,
              assetId: payload.assetId,
              tags: payload.tags,
              expectedRowVersion: 1,
            },
          })
        }
      }

      // Quiz: a fresh, unlinked copy — analytics stay with the original.
      if (includeQuiz && sourceLesson?.hasQuiz) {
        const sourceQuiz = await getQuizForLesson({ data: { lessonPublicId } })
        await saveQuiz({
          data: {
            lessonPublicId: shellLesson.publicId,
            title: sourceQuiz.title,
            passingScorePercent: sourceQuiz.passingScorePercent,
            timeLimitMinutes: sourceQuiz.timeLimitMinutes,
            maxAttempts: sourceQuiz.maxAttempts,
            isPublished: false,
            questions: sourceQuiz.questions.map((question) => ({
              publicId: null,
              questionType: question.questionType,
              questionText: question.questionText,
              points: question.points,
              explanation: question.explanation ?? undefined,
              options: question.options.map((option) => ({
                optionText: option.optionText,
                isCorrect: option.isCorrect,
              })),
              correctAnswer: question.correctAnswer ?? undefined,
            })),
          },
        })
      }

      // Position: end of module (already true) or right after a lesson.
      if (positionMode === 'after' && afterLessonId && targetModuleResult) {
        const order = resolveDuplicateOrder(
          targetModuleResult.lessons.map((lesson) => lesson.publicId),
          shellLesson.publicId,
          'after',
          afterLessonId,
        )
        const byId = new Map(targetModuleResult.lessons.map((lesson) => [lesson.publicId, lesson]))
        const orderedLessons = order.map((id) => byId.get(id)).filter((lesson) => lesson != null)
        await saveCurriculumOrder({
          data: {
            coursePublicId: targetCourseId,
            modules: created.modules.map((module) =>
              module.publicId === modulePublicId
                ? {
                    publicId: module.publicId,
                    title: module.title,
                    lessons: orderedLessons.map((lesson) => ({
                      publicId: lesson.publicId,
                      title: lesson.title,
                    })),
                  }
                : {
                    publicId: module.publicId,
                    title: module.title,
                    lessons: module.lessons.map((lesson) => ({
                      publicId: lesson.publicId,
                      title: lesson.title,
                    })),
                  },
            ),
          },
        })
      }

      return {
        targetCourseId,
        lessonPublicId: shellLesson.publicId,
        modulePublicId,
      }
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: courseQueryKeys.curriculum(result.targetCourseId),
      })
      toast.success(`Lesson duplicated to ${targetCourse?.title ?? 'the target course'}.`, {
        action: {
          label: 'Open',
          onClick: () => {
            void navigate({
              to: '/courses/$courseId/lessons/$lessonId',
              params: {
                courseId: result.targetCourseId,
                lessonId: result.lessonPublicId,
              },
            })
          },
        },
      })
      onClose()
    },
    onError: (cause) =>
      toast.error(
        cause instanceof Error ? cause.message : 'Could not duplicate the lesson. Retry?',
      ),
  })

  if (!lessonPublicId) return null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Duplicate Lesson to Another Course</DialogTitle>
          <DialogDescription>
            Copy “{lessonTitle}” into another course. Media is referenced, not re-uploaded; the
            attached quiz is copied unlinked from the original analytics.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Source: <span className="text-foreground font-medium">{lessonTitle}</span>
          </p>

          <div>
            <Label htmlFor="dup-course">Target course</Label>
            <select
              id="dup-course"
              className="h-9 w-full rounded-lg border bg-input/30 px-3 text-sm"
              value={targetCourseId}
              onChange={(event) => {
                setTargetCourseId(event.target.value)
                setTargetModuleId('')
                setPositionMode('end')
                setAfterLessonId('')
              }}
            >
              <option value="">Select a course…</option>
              {(catalog.data?.items ?? [])
                .filter((course) => course.publicId !== sourceCoursePublicId)
                .map((course) => (
                  <option key={course.publicId} value={course.publicId}>
                    {course.title}
                  </option>
                ))}
            </select>
          </div>

          {targetCourseId ? (
            <TargetModules
              courseId={targetCourseId}
              value={targetModuleId}
              onChange={(publicId) => {
                setTargetModuleId(publicId)
                setPositionMode('end')
                setAfterLessonId('')
              }}
              newModuleTitle={newModuleTitle}
              onNewModuleTitle={setNewModuleTitle}
              creatingModule={creatingModule}
              onToggleCreateModule={() => {
                setCreatingModule((current) => !current)
                setTargetModuleId('')
              }}
            />
          ) : null}

          {targetModule && !creatingModule ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Position</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="dup-position"
                  checked={positionMode === 'end'}
                  onChange={() => setPositionMode('end')}
                />
                End of module
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="dup-position"
                  checked={positionMode === 'after'}
                  onChange={() => setPositionMode('after')}
                  disabled={targetModule.lessons.length === 0}
                />
                After
              </label>
              {positionMode === 'after' ? (
                <select
                  aria-label="Insert after lesson"
                  className="h-9 w-full rounded-lg border bg-input/30 px-3 text-sm"
                  value={afterLessonId}
                  onChange={(event) => setAfterLessonId(event.target.value)}
                >
                  <option value="">Select a lesson…</option>
                  {targetModule.lessons.map((lesson) => (
                    <option key={lesson.publicId} value={lesson.publicId}>
                      {lesson.title}
                    </option>
                  ))}
                </select>
              ) : null}
            </fieldset>
          ) : null}

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Include</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeContent}
                onChange={(event) => setIncludeContent(event.target.checked)}
                disabled={!contentCopyable}
              />
              Lesson content &amp; media
              {contentCopyable ? '' : ' (none to copy)'}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeQuiz}
                onChange={(event) => setIncludeQuiz(event.target.checked)}
                disabled={!quizCopyable}
              />
              Attached quiz (copied, unlinked)
              {quizCopyable ? '' : ' (none to copy)'}
            </label>
          </fieldset>

          {conflict ? (
            <p className="text-warning text-sm" role="status">
              “{lessonTitle}” already exists in this module → will be saved as “{finalTitle}”.
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">{DUPLICATE_STARTS_DRAFT_NOTE}</p>
          {targetCourse?.requiresApproval ? (
            <p className="text-warning text-sm" role="status">
              “{targetCourse.title}” requires approval — the copy will be created in Draft and enter
              the review queue.
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={
                !targetCourseId ||
                (!targetModuleId && !creatingModule) ||
                (creatingModule && newModuleTitle.trim().length < 3) ||
                duplicate.isPending
              }
              onClick={() => duplicate.mutate()}
            >
              {duplicate.isPending ? <Spinner className="size-4" /> : null}
              Duplicate Lesson
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TargetModules({
  courseId,
  value,
  onChange,
  newModuleTitle,
  onNewModuleTitle,
  creatingModule,
  onToggleCreateModule,
}: {
  courseId: string
  value: string
  onChange: (publicId: string) => void
  newModuleTitle: string
  onNewModuleTitle: (title: string) => void
  creatingModule: boolean
  onToggleCreateModule: () => void
}) {
  const curriculum = useQuery(curriculumQueryOptions(courseId))

  if (curriculum.isPending) return <Spinner className="size-4" />

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="dup-module">Target module</Label>
      {creatingModule ? (
        <Input
          id="dup-module"
          value={newModuleTitle}
          onChange={(event) => onNewModuleTitle(event.target.value)}
          placeholder="New module title"
          autoFocus
        />
      ) : (
        <select
          id="dup-module"
          className="h-9 w-full rounded-lg border bg-input/30 px-3 text-sm"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select a module…</option>
          {(curriculum.data?.modules ?? []).map((module) => (
            <option key={module.publicId} value={module.publicId}>
              {module.title} ({module.lessons.length} lessons)
            </option>
          ))}
        </select>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={onToggleCreateModule}
      >
        {creatingModule ? 'Use an existing module' : '+ New module'}
      </Button>
    </div>
  )
}
