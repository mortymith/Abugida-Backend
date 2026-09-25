import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Delete02Icon,
  DragDropIcon,
  Edit02Icon,
  LockIcon,
  FolderIcon,
  PlusSignIcon,
} from '@hugeicons/core-free-icons'
import { Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { StatusPill } from './courses.status-pill'
import type { CurriculumDTO, CurriculumModuleDTO } from '../courses.types'

/**
 * S-2.3 / S-2.6 drag-and-drop sortable module/lesson tree.
 * Keyboard equivalents (Move up/down buttons) per spec 11 a11y contract;
 * lesson rows surface review pills, per-lesson student counts and 🔒 rules.
 */
export function CurriculumTree({
  curriculum,
  coursePublicId,
  authoring,
  busy,
  onCreateModule,
  onCreateLesson,
  onRenameModule,
  onDeleteModule,
  onDeleteLesson,
  onReorder,
  onOpenUnlockRules,
  onDuplicateLesson,
}: {
  curriculum: CurriculumDTO
  coursePublicId: string
  authoring: boolean
  busy?: boolean
  onCreateModule: (title: string) => void
  onCreateLesson: (modulePublicId: string, title: string) => void
  onRenameModule: (modulePublicId: string, title: string) => void
  onDeleteModule: (modulePublicId: string) => void
  onDeleteLesson: (lessonPublicId: string) => void
  onReorder: (moduleOrder: string[], lessonOrder: Record<string, string[]>) => void
  onOpenUnlockRules?: (lessonPublicId: string) => void
  onDuplicateLesson?: (lessonPublicId: string) => void
}) {
  const [moduleOrder, setModuleOrder] = useState<string[]>(() =>
    curriculum.modules.map((module) => module.publicId),
  )
  const [lessonOrder, setLessonOrder] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      curriculum.modules.map((module) => [
        module.publicId,
        module.lessons.map((lesson) => lesson.publicId),
      ]),
    ),
  )
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // Track external refetches (e.g. after create/delete) without clobbering
  // in-flight drag state: adopt new ids that we don't know yet.
  const knownModules = new Set(moduleOrder)
  for (const module of curriculum.modules) {
    if (!knownModules.has(module.publicId)) {
      setModuleOrder((previous) => [...previous, module.publicId])
      setLessonOrder((previous) => ({
        ...previous,
        [module.publicId]: module.lessons.map((lesson) => lesson.publicId),
      }))
    }
  }

  const modulesById = new Map(curriculum.modules.map((module) => [module.publicId, module]))
  const orderedModules = moduleOrder
    .map((publicId) => modulesById.get(publicId))
    .filter((module): module is CurriculumModuleDTO => module != null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const activeIsModule = modulesById.has(activeId)
    const overIsModule = modulesById.has(overId)

    if (activeIsModule && overIsModule) {
      const next = reorder(moduleOrder, activeId, overId)
      setModuleOrder(next)
      onReorder(next, lessonOrder)
      return
    }
    if (!activeIsModule && !overIsModule) {
      const sourceModule = Object.keys(lessonOrder).find((key) =>
        lessonOrder[key].includes(activeId),
      )
      const targetModule = Object.keys(lessonOrder).find((key) => lessonOrder[key].includes(overId))
      if (!sourceModule || !targetModule) return
      const next = { ...lessonOrder }
      next[sourceModule] = (lessonOrder[sourceModule] ?? []).filter((id) => id !== activeId)
      const target = [...(lessonOrder[targetModule] ?? [])]
      target.splice(target.indexOf(overId), 0, activeId)
      next[targetModule] = target
      setLessonOrder(next)
      onReorder(moduleOrder, next)
    }
  }

  const move = (list: string[], id: string, delta: -1 | 1): string[] => {
    const index = list.indexOf(id)
    const target = index + delta
    if (index < 0 || target < 0 || target >= list.length) return list
    const next = [...list]
    next.splice(index, 1)
    next.splice(target, 0, id)
    return next
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={moduleOrder} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-3" role="list" aria-label="Course curriculum">
          {orderedModules.map((module) => {
            const lessons = (lessonOrder[module.publicId] ?? [])
              .map((publicId) => module.lessons.find((lesson) => lesson.publicId === publicId))
              .filter((lesson) => lesson != null)
            const isCollapsed = collapsed.has(module.publicId)

            return (
              <SortableModule
                key={module.publicId}
                module={module}
                authoring={authoring}
                busy={busy}
                collapsed={isCollapsed}
                onToggleCollapse={() =>
                  setCollapsed((previous) => {
                    const next = new Set(previous)
                    if (next.has(module.publicId)) next.delete(module.publicId)
                    else next.add(module.publicId)
                    return next
                  })
                }
                lessons={lessons}
                lessonOrder={lessonOrder[module.publicId] ?? []}
                onMoveLesson={(lessonId, delta) => {
                  const next = {
                    ...lessonOrder,
                    [module.publicId]: move(lessonOrder[module.publicId] ?? [], lessonId, delta),
                  }
                  setLessonOrder(next)
                  onReorder(moduleOrder, next)
                }}
                onMoveModule={(delta) => {
                  const next = move(moduleOrder, module.publicId, delta)
                  setModuleOrder(next)
                  onReorder(next, lessonOrder)
                }}
                onCreateLesson={(title) => onCreateLesson(module.publicId, title)}
                onRenameModule={(title) => onRenameModule(module.publicId, title)}
                onDeleteModule={() => onDeleteModule(module.publicId)}
                onDeleteLesson={onDeleteLesson}
                onOpenUnlockRules={onOpenUnlockRules}
                onDuplicateLesson={onDuplicateLesson}
                coursePublicId={coursePublicId}
              />
            )
          })}
        </div>
      </SortableContext>

      {authoring ? (
        <InlineCreate
          key={curriculum.modules.length}
          placeholder="Add your first module to start building the curriculum."
          buttonLabel="Add Module"
          onCreate={onCreateModule}
          leadingIcon={<HugeiconsIcon icon={FolderIcon} size={16} />}
        />
      ) : null}

      {busy ? (
        <div className="flex items-center justify-center py-2 text-sm text-muted-foreground">
          <Spinner className="size-4" /> Saving curriculum…
        </div>
      ) : null}
    </DndContext>
  )
}

function SortableModule({
  module,
  lessons,
  lessonOrder,
  authoring,
  busy,
  collapsed,
  onToggleCollapse,
  onMoveLesson,
  onMoveModule,
  onCreateLesson,
  onRenameModule,
  onDeleteModule,
  onDeleteLesson,
  onOpenUnlockRules,
  onDuplicateLesson,
  coursePublicId,
}: {
  module: CurriculumModuleDTO
  lessons: CurriculumModuleDTO['lessons']
  lessonOrder: string[]
  authoring: boolean
  busy?: boolean
  collapsed: boolean
  onToggleCollapse: () => void
  onMoveLesson: (lessonPublicId: string, delta: -1 | 1) => void
  onMoveModule: (delta: -1 | 1) => void
  onCreateLesson: (title: string) => void
  onRenameModule: (title: string) => void
  onDeleteModule: () => void
  onDeleteLesson: (lessonPublicId: string) => void
  onOpenUnlockRules?: (lessonPublicId: string) => void
  onDuplicateLesson?: (lessonPublicId: string) => void
  coursePublicId: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: module.publicId,
    disabled: !authoring || Boolean(busy),
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={'rounded-xl border bg-card shadow-sm' + (isDragging ? ' z-10 shadow-lg' : '')}
      role="listitem"
    >
      <div className="flex items-center gap-2 p-3">
        {authoring ? (
          <button
            type="button"
            className="cursor-grab touch-none text-muted-foreground"
            aria-label={`Drag module ${module.title}`}
            {...attributes}
            {...listeners}
          >
            <HugeiconsIcon icon={DragDropIcon} size={16} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={!collapsed}
        >
          <HugeiconsIcon icon={FolderIcon} size={16} className="shrink-0 text-violet-500" />
          <ModuleTitle title={module.title} editable={authoring} onSave={onRenameModule} />
          <span className="text-xs tabular-nums text-muted-foreground">
            {module.lessons.length} lessons
          </span>
        </button>
        {authoring ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Move module up"
              onClick={() => onMoveModule(-1)}
            >
              <HugeiconsIcon icon={ArrowUpIcon} size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Move module down"
              onClick={() => onMoveModule(1)}
            >
              <HugeiconsIcon icon={ArrowDownIcon} size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Delete module ${module.title}`}
              onClick={onDeleteModule}
            >
              <HugeiconsIcon icon={Delete02Icon} size={14} />
            </Button>
          </div>
        ) : null}
      </div>

      {collapsed ? null : (
        <div className="border-t px-3 py-2">
          <SortableContext items={lessonOrder} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col" role="list" aria-label={`Lessons in ${module.title}`}>
              {lessons.map((lesson) => (
                <SortableLesson
                  key={lesson.publicId}
                  lesson={lesson}
                  authoring={authoring}
                  disabled={Boolean(busy)}
                  onMove={(delta) => onMoveLesson(lesson.publicId, delta)}
                  onDelete={() => onDeleteLesson(lesson.publicId)}
                  onOpenUnlockRules={onOpenUnlockRules}
                  onDuplicateLesson={onDuplicateLesson}
                  coursePublicId={coursePublicId}
                />
              ))}
            </ul>
          </SortableContext>
          {authoring ? (
            <div className="pt-1">
              <InlineCreate
                key={lessonOrder.length}
                placeholder="Add a lesson…"
                buttonLabel="Add Lesson"
                onCreate={onCreateLesson}
                compact
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function SortableLesson({
  lesson,
  authoring,
  disabled,
  onMove,
  onDelete,
  onOpenUnlockRules,
  onDuplicateLesson,
  coursePublicId,
}: {
  lesson: CurriculumModuleDTO['lessons'][number]
  authoring: boolean
  disabled?: boolean
  onMove: (delta: -1 | 1) => void
  onDelete: () => void
  onOpenUnlockRules?: (lessonPublicId: string) => void
  onDuplicateLesson?: (lessonPublicId: string) => void
  coursePublicId: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.publicId,
    disabled: !authoring || Boolean(disabled),
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={
        'flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60' +
        (isDragging ? ' z-10 bg-card shadow-md' : '')
      }
      role="listitem"
    >
      {authoring ? (
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground"
          aria-label={`Drag lesson ${lesson.title}`}
          {...attributes}
          {...listeners}
        >
          <HugeiconsIcon icon={DragDropIcon} size={14} />
        </button>
      ) : null}
      <Link
        to="/courses/$courseId/lessons/$lessonId"
        params={{ courseId: coursePublicId, lessonId: lesson.publicId }}
        className="min-w-0 flex-1 truncate text-sm hover:underline"
      >
        {lesson.title}
      </Link>
      <StatusPill tone={lesson.reviewStatus} />
      {lesson.hasUnlockRules ? (
        <HugeiconsIcon icon={LockIcon} size={14} aria-label="Has unlock rules" />
      ) : null}
      <span className="text-xs tabular-nums text-muted-foreground">
        {lesson.studentCount} students
      </span>
      {authoring ? (
        <div className="flex items-center gap-0.5">
          {onOpenUnlockRules ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Unlock rules for ${lesson.title}`}
              title="🔒 Rules"
              onClick={() => onOpenUnlockRules(lesson.publicId)}
            >
              <HugeiconsIcon icon={LockIcon} size={14} />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Move lesson up"
            onClick={() => onMove(-1)}
          >
            <HugeiconsIcon icon={ArrowUpIcon} size={12} />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Move lesson down"
            onClick={() => onMove(1)}
          >
            <HugeiconsIcon icon={ArrowDownIcon} size={12} />
          </Button>
          {onDuplicateLesson ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Duplicate ${lesson.title} to another course`}
              title="Duplicate to another course"
              onClick={() => onDuplicateLesson(lesson.publicId)}
            >
              <HugeiconsIcon icon={Edit02Icon} size={12} />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Delete lesson ${lesson.title}`}
            onClick={onDelete}
          >
            <HugeiconsIcon icon={Delete02Icon} size={12} />
          </Button>
        </div>
      ) : null}
    </li>
  )
}

function ModuleTitle({
  title,
  editable,
  onSave,
}: {
  title: string
  editable: boolean
  onSave: (title: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(title)

  if (!editable) return <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
  if (editing) {
    return (
      <form
        className="flex min-w-0 flex-1 gap-1"
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = value.trim()
          if (trimmed.length >= 3) onSave(trimmed)
          setEditing(false)
        }}
      >
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label="Module name"
          autoFocus
          minLength={3}
        />
        <Button type="submit" size="sm" variant="secondary">
          Save
        </Button>
      </form>
    )
  }
  return (
    <>
      <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Rename module ${title}`}
        onClick={() => {
          setValue(title)
          setEditing(true)
        }}
      >
        <HugeiconsIcon icon={Edit02Icon} size={12} />
      </Button>
    </>
  )
}

function InlineCreate({
  placeholder,
  buttonLabel,
  onCreate,
  compact,
  leadingIcon,
}: {
  placeholder: string
  buttonLabel: string
  onCreate: (title: string) => void
  compact?: boolean
  leadingIcon?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  if (!open) {
    return (
      <Button
        variant="ghost"
        size={compact ? 'sm' : 'default'}
        onClick={() => setOpen(true)}
        className="w-full justify-start text-muted-foreground"
      >
        <HugeiconsIcon icon={PlusSignIcon} size={16} />
        {leadingIcon}
        {buttonLabel}
      </Button>
    )
  }
  return (
    <form
      className="flex gap-1"
      onSubmit={(event) => {
        event.preventDefault()
        const trimmed = value.trim()
        if (trimmed.length >= 3) {
          onCreate(trimmed)
          setValue('')
          setOpen(false)
        }
      }}
    >
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={buttonLabel}
        autoFocus
        minLength={3}
      />
      <Button type="submit" size="sm" disabled={value.trim().length < 3}>
        Add
      </Button>
    </form>
  )
}

function reorder(list: string[], activeId: string, overId: string): string[] {
  const from = list.indexOf(activeId)
  const to = list.indexOf(overId)
  if (from < 0 || to < 0) return list
  const next = [...list]
  next.splice(from, 1)
  next.splice(to, 0, activeId)
  return next
}
