import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '#/components/common/toast'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, ArrowDown01Icon, Search01Icon } from '@hugeicons/core-free-icons'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { catalogQueryOptions } from '../hooks/courses.queries'
import {
  catalogStatusSchema,
  catalogTypeSchema,
  catalogSortSchema,
} from '../schemas/courses.catalog.schema'
import type { CatalogQuery } from '../schemas/courses.catalog.schema'
import { CourseCard } from './courses.course-card'
import { AiCourseGeneratorModal } from './courses.ai-course-modal'
import { BulkImportModal } from './courses.import-modal'
import { useRole } from '#/features/auth'

type Search = {
  search?: string
  status?: string
  type?: string
  sort?: string
}

/**
 * S-2.1 Course Catalog / Grid: filter pills, search, sort, split create
 * button (blank/template/AI/bulk import), hover quick actions, bulk select
 * (Publish/Archive/Delete), skeleton/empty/error states.
 */
export function CoursesCatalog() {
  const role = useRole()
  const navigate = useNavigate()
  const search = useSearch({ from: '/_app/courses/' })
  const queryClient = useQueryClient()

  const isStatus = (value: string | undefined): value is CatalogQuery['status'] =>
    (catalogStatusSchema.options as readonly string[]).includes(value ?? '')
  const isType = (value: string | undefined): value is CatalogQuery['type'] =>
    (catalogTypeSchema.options as readonly string[]).includes(value ?? '')
  const isSort = (value: string | undefined): value is CatalogQuery['sort'] =>
    (catalogSortSchema.options as readonly string[]).includes(value ?? '')

  const query: CatalogQuery = {
    search: search.search,
    status: isStatus(search.status) ? search.status : 'all',
    type: isType(search.type) ? search.type : 'all',
    sort: isSort(search.sort) ? search.sort : 'recent',
    page: 0,
  }
  const catalog = useQuery(catalogQueryOptions(query))
  const isAuthoring = role === 'admin' || role === 'editor'

  const [searchDraft, setSearchDraft] = useState(search.search ?? '')
  const [selectionMode, setSelectionMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState<{
    action: 'archive' | 'delete'
    coursePublicId: string
    title: string
  } | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const patchSearch = (patch: Partial<Search>) =>
    void navigate({ to: '/courses', search: { ...search, ...patch } })

  const bulkAction = useMutation({
    mutationFn: async (action: 'archive' | 'delete') => {
      const { archiveCourse, deleteCourse } = await import('../server/all')
      for (const coursePublicId of selected) {
        if (action === 'archive') await archiveCourse({ data: { coursePublicId } })
        else await deleteCourse({ data: { coursePublicId } })
      }
      return action
    },
    onSuccess: (action) => {
      void queryClient.invalidateQueries({ queryKey: ['courses'] })
      setSelected(new Set())
      setSelectionMode(false)
      toastBulk(action)
    },
  })

  const quickArchive = useMutation({
    mutationFn: async (coursePublicId: string) => {
      const { archiveCourse } = await import('../server/all')
      return archiveCourse({ data: { coursePublicId } })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['courses'] })
      toast.success('Course archived successfully.')
    },
  })
  const quickDuplicate = useMutation({
    mutationFn: async (coursePublicId: string) => {
      const { duplicateCourse } = await import('../server/all')
      return duplicateCourse({ data: { coursePublicId } })
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['courses'] })
      toast.success('Course duplicated as draft.')
      void navigate({ to: '/courses/new', search: { step: 1, from: result.coursePublicId } })
    },
  })
  const quickDelete = useMutation({
    mutationFn: async (coursePublicId: string) => {
      const { deleteCourse } = await import('../server/all')
      return deleteCourse({ data: { coursePublicId } })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['courses'] })
      toast.success('Course deleted.')
    },
  })

  const items = catalog.data?.items ?? []
  const totalCount = catalog.data?.totalCount ?? 0

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Courses</h1>
          <p className="text-sm text-muted-foreground">Manage your course catalog.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault()
              patchSearch({ search: searchDraft || undefined })
            }}
          >
            <div className="relative">
              <HugeiconsIcon
                icon={Search01Icon}
                size={16}
                className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                className="w-56 pl-9"
                placeholder="Search courses…"
                aria-label="Search courses"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
              />
            </div>
          </form>
          <select
            aria-label="Sort courses"
            className="h-9 rounded-lg border bg-input/30 px-3 text-sm"
            value={query.sort}
            onChange={(event) => patchSearch({ sort: event.target.value })}
          >
            <option value="recent">Most recent</option>
            <option value="title">Title A–Z</option>
            <option value="students">Most students</option>
          </select>
          {isAuthoring ? (
            <CreateMenu onAi={() => setAiOpen(true)} onImport={() => setImportOpen(true)} />
          ) : null}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter courses">
        {(['all', 'published', 'draft', 'archived'] as const).map((status) => (
          <FilterPill
            key={status}
            active={query.status === status}
            label={
              status === 'all'
                ? 'All'
                : status === 'archived'
                  ? 'Archived'
                  : status === 'draft'
                    ? 'Draft'
                    : 'Published'
            }
            onClick={() => patchSearch({ status })}
          />
        ))}
        <span aria-hidden className="text-muted-foreground">
          |
        </span>
        {(['all', 'self_paced', 'instructor_led', 'hybrid'] as const).map((type) => (
          <FilterPill
            key={type}
            active={query.type === type}
            label={
              type === 'all'
                ? 'Any type'
                : type === 'self_paced'
                  ? 'Self Paced'
                  : type === 'instructor_led'
                    ? 'Live'
                    : 'Hybrid'
            }
            onClick={() => patchSearch({ type })}
          />
        ))}
        {isAuthoring && items.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => {
              setSelectionMode((previous) => !previous)
              setSelected(new Set())
            }}
          >
            {selectionMode ? 'Exit selection' : 'Select'}
          </Button>
        ) : null}
      </div>

      {selectionMode && selected.size > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2 text-sm">
          <span className="tabular-nums">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => bulkAction.mutate('archive')}>
            Archive
          </Button>
          <Button size="sm" variant="destructive" onClick={() => bulkAction.mutate('delete')}>
            Delete
          </Button>
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {catalog.isPending
          ? 'Loading courses…'
          : `Showing ${items.length} of ${totalCount} courses`}
      </p>

      {catalog.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-72 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : catalog.isError ? (
        <RetryErrorState onRetry={() => void catalog.refetch()} />
      ) : items.length === 0 ? (
        query.search || query.status !== 'all' || query.type !== 'all' ? (
          <EmptyState
            variant="compact"
            title="No courses match your filters."
            description="Adjust filters or create a new course."
            action={
              <Button
                variant="link"
                onClick={() =>
                  void navigate({
                    to: '/courses',
                    search: {
                      search: undefined,
                      status: undefined,
                      type: undefined,
                      sort: undefined,
                    },
                  })
                }
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No courses yet. Create your first course!"
            action={
              isAuthoring ? (
                <CreateMenu
                  onAi={() => setAiOpen(true)}
                  onImport={() => setImportOpen(true)}
                  primary
                />
              ) : null
            }
          />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((course) => (
            <CourseCard
              key={course.publicId}
              course={course}
              selectionMode={selectionMode}
              selected={selected.has(course.publicId)}
              onToggleSelect={() =>
                setSelected((previous) => {
                  const next = new Set(previous)
                  if (next.has(course.publicId)) next.delete(course.publicId)
                  else next.add(course.publicId)
                  return next
                })
              }
              onArchive={() =>
                setConfirm({
                  action: 'archive',
                  coursePublicId: course.publicId,
                  title: course.title,
                })
              }
              onDuplicate={() => quickDuplicate.mutate(course.publicId)}
              onDelete={() =>
                setConfirm({
                  action: 'delete',
                  coursePublicId: course.publicId,
                  title: course.title,
                })
              }
            />
          ))}
        </div>
      )}

      {items.length < totalCount ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => {
              const nextPage = query.page + 1
              void queryClient.prefetchQuery(catalogQueryOptions({ ...query, page: nextPage }))
              toast.info('Loading more courses…')
            }}
          >
            Load More
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm != null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.action === 'delete' ? 'Delete this course?' : 'Archive this course?'}
        body={
          confirm?.action === 'delete'
            ? `Are you sure you want to delete "${confirm.title}"? This action cannot be undone.`
            : `Archived courses are hidden from the default catalog view. You can restore by publishing again.`
        }
        confirmLabel={confirm?.action === 'delete' ? 'Delete course' : 'Archive'}
        destructive={confirm?.action === 'delete'}
        onConfirm={() => {
          if (!confirm) return
          return confirm.action === 'delete'
            ? quickDelete.mutateAsync(confirm.coursePublicId).then(() => undefined)
            : quickArchive.mutateAsync(confirm.coursePublicId).then(() => undefined)
        }}
      />

      <AiCourseGeneratorModal open={aiOpen} onOpenChange={setAiOpen} />
      <BulkImportModal open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}

function toastBulk(action: 'archive' | 'delete') {
  toast.success(action === 'archive' ? 'Courses archived.' : 'Courses deleted.')
}

function FilterPill({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={
        'rounded-full border px-3 py-1 text-sm transition-colors' +
        (active
          ? ' border-violet-500 bg-violet-500 text-white'
          : ' bg-card text-muted-foreground hover:bg-muted')
      }
      onClick={onClick}
    >
      {label}
    </button>
  )
}

/** "Create Course" split button (spec S-A.1 / S-2.1 navigation). */
export function CreateMenu({
  onAi,
  onImport,
  primary,
}: {
  onAi: () => void
  onImport: () => void
  primary?: boolean
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const items: Array<{ label: string; onSelect: () => void; href?: string }> = [
    {
      label: 'Blank course',
      onSelect: () => navigate({ to: '/courses/new', search: { step: 1 } }),
    },
    { label: 'From template', onSelect: () => navigate({ to: '/courses/templates' }) },
    { label: 'With AI generator', onSelect: onAi },
    { label: 'Bulk import', onSelect: onImport },
  ]

  return (
    <div className="relative">
      <Button render={<Link to="/courses/new" search={{ step: 1 }} />}>
        <HugeiconsIcon icon={Add01Icon} size={16} />
        Create Course
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="-ml-px"
        aria-label="More ways to create a course"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((previous) => !previous)}
      >
        <HugeiconsIcon icon={ArrowDown01Icon} size={16} />
      </Button>
      {open ? (
        <ul
          role="menu"
          aria-label="Create course options"
          className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-lg border bg-card py-1 shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {primary ? null : null}
    </div>
  )
}
