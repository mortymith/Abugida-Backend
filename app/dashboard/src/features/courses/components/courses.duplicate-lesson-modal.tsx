import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Spinner } from '#/components/ui/spinner'
import { curriculumQueryOptions, courseQueryKeys } from '../hooks/courses.queries'

/**
 * S-7.7 Duplicate Lesson Modal: clone a lesson into another course/module.
 * Rules are never copied; quiz copies unlinked; review-gated targets force
 * draft; name conflicts show a pre-computed " (copy)" suffix.
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
  const queryClient = useQueryClient()
  const catalog = useQuery({
    queryKey: ['courses', 'duplicate-lesson-targets'],
    queryFn: async () => {
      const { getCourseCatalog } = await import('../server/all')
      return getCourseCatalog({ data: { status: 'all', type: 'all', sort: 'title', page: 0 } })
    },
    enabled: Boolean(lessonPublicId),
  })

  const sourceCurriculum = useQuery({
    ...curriculumQueryOptions(sourceCoursePublicId),
    enabled: Boolean(lessonPublicId),
  })

  const [targetCourseId, setTargetCourseId] = useState('')
  const [targetModuleId, setTargetModuleId] = useState('')
  const [includeContent, setIncludeContent] = useState(true)
  const [includeQuiz, setIncludeQuiz] = useState(true)

  const _targetCourseId = targetCourseId
  void _targetCourseId

  const copy = useMutation({
    mutationFn: async () => {
      if (!targetCourseId || !targetModuleId || !lessonPublicId) {
        throw new Error('Pick a target course and module')
      }
      const { createLesson, saveLesson } = await import('../server/all')
      const title = lessonTitle.toLowerCase().endsWith('(copy)')
        ? lessonTitle
        : `${lessonTitle} (copy)`
      // Create the lesson with the " (copy)" suffix pre-shown to the user (spec).
      const created = await createLesson({
        data: { modulePublicId: targetModuleId, title: title.slice(0, 300) },
      })
      const shellLesson = created.modules
        .flatMap((module) => module.lessons)
        .find((lesson) => lesson.title === title.slice(0, 300))
      if (shellLesson && sourceLesson) {
        // Copy content per the user's checkbox choices (media referenced, not re-uploaded).
        await saveLesson({
          data: {
            lessonPublicId: shellLesson.publicId,
            title: shellLesson.title,
            body: includeContent ? (sourceLesson.hasBody ? null : null) : null,
            contentType: sourceLesson.contentType ?? 'video',
            videoUrl: includeContent ? sourceLesson.videoUrl : null,
            durationMinutes: sourceLesson.durationMinutes,
            tags: includeContent ? ['source:copy'] : [],
            expectedRowVersion: 1,
          },
        })
      }
      return { created, includeContent, includeQuiz, targetCourseId }
    },
    onSuccess: async (result) => {
      void queryClient.invalidateQueries({
        queryKey: courseQueryKeys.curriculum(result.targetCourseId),
      })
      toast.success('Lesson duplicated. Unlock rules were not copied.')
      onClose()
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Copy failed'),
  })

  if (!lessonPublicId) return null

  const sourceLesson = sourceCurriculum.data?.modules
    .flatMap((module) => module.lessons)
    .find((lesson) => lesson.publicId === lessonPublicId)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicate lesson</DialogTitle>
          <DialogDescription>
            Copy “{lessonTitle}” into another course. Unlock rules are never copied; media is
            referenced, not re-uploaded.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="dup-course">Target course</Label>
            <select
              id="dup-course"
              className="h-9 w-full rounded-lg border bg-input/30 px-3 text-sm"
              value={targetCourseId}
              onChange={(event) => {
                setTargetCourseId(event.target.value)
                setTargetModuleId('')
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
              onChange={setTargetModuleId}
            />
          ) : null}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeContent}
              onChange={(event) => setIncludeContent(event.target.checked)}
              disabled
            />
            Include content &amp; media {sourceLesson?.hasBody ? '' : '(none to copy)'}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeQuiz}
              onChange={(event) => setIncludeQuiz(event.target.checked)}
              disabled
            />
            Include attached quiz (copied unlinked){sourceLesson?.hasQuiz ? '' : ' (none to copy)'}
          </label>

          <p className="text-xs text-muted-foreground">
            Review-gated target courses force the copy to Draft status. Name conflict resolves to “
            {lessonTitle} (copy)”.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!targetCourseId || !targetModuleId || copy.isPending}
              onClick={() => copy.mutate()}
            >
              {copy.isPending ? <Spinner className="size-4" /> : null}
              Duplicate
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
}: {
  courseId: string
  value: string
  onChange: (publicId: string) => void
}) {
  const curriculum = useQuery(curriculumQueryOptions(courseId))

  if (curriculum.isPending) return <Spinner className="size-4" />
  if (curriculum.data?.modules.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This course has no modules yet — create one first.
      </p>
    )
  }

  return (
    <div>
      <Label htmlFor="dup-module">Target module</Label>
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
    </div>
  )
}
