import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { templatesQueryOptions } from '../hooks/courses.queries'
import { TEMPLATE_CATEGORIES } from '../schemas/courses.workflow.schema'
import type { CourseTemplateDTO } from '../courses.types'

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  exam_prep: 'Exam Prep',
  corporate_training: 'Corporate Training',
  language: 'Language',
  onboarding: 'Onboarding',
  workshops: 'Workshops',
}

/**
 * S-2.12 Template Library: search + category chips, 3-column gallery,
 * read-only full-structure preview, "Use" imports a draft pre-filled from
 * the template (rows tagged source: template).
 */
export function TemplateGallery() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/_app/courses/templates' })
  const queryClient = useQueryClient()

  const [searchDraft, setSearchDraft] = useState(search.search ?? '')
  const [preview, setPreview] = useState<CourseTemplateDTO | null>(null)

  const templates = useQuery(
    templatesQueryOptions({
      search: search.search,
      category: (TEMPLATE_CATEGORIES as readonly string[]).includes(search.category ?? '')
        ? (search.category as never)
        : 'all',
    }),
  )

  const use = useMutation({
    mutationFn: async (templatePublicId: string) => {
      const { useTemplate } = await import('../server/all')
      return useTemplate({ data: { templatePublicId } })
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['courses'] })
      toast.success('Template imported. Customize it in Course Detail.')
      void navigate({ to: '/courses/$courseId', params: { courseId: result.coursePublicId } })
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Import failed'),
  })

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Template Library</h1>
          <p className="text-sm text-muted-foreground">
            Start from a proven structure instead of a blank canvas.
          </p>
        </div>
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
            void navigate({
              to: '/courses/templates',
              search: { ...search, search: searchDraft || undefined },
            })
          }}
        >
          <Input
            className="w-64"
            placeholder="Search templates…"
            aria-label="Search templates"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
        </form>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Template categories">
        {TEMPLATE_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            aria-pressed={(search.category ?? 'all') === category}
            className={
              'rounded-full border px-3 py-1 text-sm transition-colors' +
              ((search.category ?? 'all') === category
                ? ' border-violet-500 bg-violet-500 text-white'
                : ' bg-card text-muted-foreground hover:bg-muted')
            }
            onClick={() =>
              void navigate({ to: '/courses/templates', search: { ...search, category } })
            }
          >
            {CATEGORY_LABELS[category] ?? category}
          </button>
        ))}
      </div>

      {templates.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-48 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : templates.isError ? (
        <RetryErrorState onRetry={() => void templates.refetch()} />
      ) : templates.data.length === 0 ? (
        <EmptyState
          title="No templates in this category yet."
          description="Save any course as a template from its Course Detail menu."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.data.map((template) => (
            <article
              key={template.publicId}
              className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold">
                  <span aria-hidden>📚</span> {template.name}
                </h2>
                {template.isFeatured ? (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    Featured
                  </span>
                ) : null}
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {template.description ?? 'No description.'}
              </p>
              <ul className="text-xs tabular-nums text-muted-foreground">
                <li>{template.moduleCount} modules</li>
                <li>{template.lessonCount} lessons</li>
                <li>{template.quizCount} quizzes</li>
              </ul>
              <div className="mt-auto flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setPreview(template)}>
                  Preview
                </Button>
                <Button
                  size="sm"
                  onClick={() => use.mutate(template.publicId)}
                  disabled={use.isPending}
                >
                  {use.isPending ? <Spinner className="size-4" /> : null}
                  Use
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {preview ? (
        <Dialog open onOpenChange={(open) => !open && setPreview(null)}>
          <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{preview.name}</DialogTitle>
              <DialogDescription>Read-only curriculum preview.</DialogDescription>
            </DialogHeader>
            <ol className="flex list-decimal flex-col gap-3 pl-5">
              {preview.structure.modules.map((module, moduleIndex) => (
                <li key={moduleIndex}>
                  <p className="font-medium">{module.title}</p>
                  <ul className="ml-4 list-disc text-sm text-muted-foreground">
                    {module.lessons.map((lesson, lessonIndex) => (
                      <li key={lessonIndex}>
                        {lesson.title}{' '}
                        <span className="text-xs">
                          ({lesson.contentType}
                          {lesson.durationMinutes ? `, ~${lesson.durationMinutes} min` : ''})
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
            <div className="flex justify-end">
              <Button
                disabled={use.isPending}
                onClick={() => {
                  use.mutate(preview.publicId)
                  setPreview(null)
                }}
              >
                Use this template
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
