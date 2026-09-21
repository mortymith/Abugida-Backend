import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Edit02Icon, ArchiveIcon, Delete02Icon, Copy01Icon } from '@hugeicons/core-free-icons'
import { Button } from '#/components/ui/button'
import { StatusPill } from './courses.status-pill'
import type { CourseCatalogItem } from '../courses.types'

/**
 * S-2.1 course card: thumbnail, type badge, title, 2-line description,
 * status + lesson/student counts, hover quick actions (Edit/Duplicate/
 * Archive/Delete), bulk-select checkbox in selection mode.
 */
export function CourseCard({
  course,
  selectionMode,
  selected,
  onToggleSelect,
  onArchive,
  onDuplicate,
  onDelete,
}: {
  course: CourseCatalogItem
  selectionMode: boolean
  selected: boolean
  onToggleSelect: () => void
  onArchive: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const isArchived = course.status === 'archived'

  return (
    <div
      className={
        'group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md' +
        (isArchived ? ' opacity-60 grayscale' : '') +
        (selected ? ' ring-2 ring-violet-500' : '')
      }
    >
      <Link
        to="/courses/$courseId"
        params={{ courseId: course.publicId }}
        className="block focus-visible:outline-none"
        aria-label={`Open course ${course.title}`}
      >
        <div className="relative">
          <div className="flex h-40 w-full items-center justify-center rounded-t-xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-950 dark:to-indigo-950">
            <span className="text-lg font-semibold text-violet-600 dark:text-violet-300">
              {course.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <span className="absolute top-2 left-2">
            <StatusPill
              tone={course.courseType === 'instructor_led' ? 'live' : course.courseType}
            />
          </span>
          {selectionMode ? (
            <span className="absolute top-2 right-2 rounded-md bg-white/90 p-1.5 dark:bg-slate-900/90">
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleSelect()}
                aria-label={`Select ${course.title}`}
                className="size-4 cursor-pointer accent-violet-600"
              />
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-col gap-2 p-4">
        <Link
          to="/courses/$courseId"
          params={{ courseId: course.publicId }}
          className="line-clamp-1 font-semibold hover:underline"
        >
          {course.title}
        </Link>
        <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
          {course.description ?? 'No description yet.'}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <StatusPill tone={course.status} />
          <span className="text-xs text-muted-foreground">{course.lessonCount} lessons</span>
          <span aria-hidden className="text-muted-foreground">
            ·
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {course.studentCount} students
          </span>
          {course.requiresApproval ? <StatusPill tone="review" label="Approval required" /> : null}
        </div>

        <div className="mt-2 flex items-center justify-between border-t pt-2">
          <span className="text-sm font-semibold tabular-nums">
            {course.isFree
              ? 'Free'
              : course.priceAmount
                ? `${course.priceCurrency} ${course.priceAmount}`
                : '—'}
          </span>
          {!selectionMode ? (
            <div
              className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
              role="group"
              aria-label={`Quick actions for ${course.title}`}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit"
                title="Edit"
                render={<Link to="/courses/$courseId" params={{ courseId: course.publicId }} />}
              >
                <HugeiconsIcon icon={Edit02Icon} size={16} />
              </Button>
              <QuickActionButton icon={Copy01Icon} label="Duplicate" onClick={onDuplicate} />
              {isArchived ? null : (
                <QuickActionButton icon={ArchiveIcon} label="Archive" onClick={onArchive} />
              )}
              <QuickActionButton
                icon={Delete02Icon}
                label="Delete"
                onClick={onDelete}
                destructive
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function QuickActionButton({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: typeof Edit02Icon
  label: string
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={destructive ? 'text-destructive hover:text-destructive' : undefined}
    >
      <HugeiconsIcon icon={icon} size={16} />
    </Button>
  )
}
