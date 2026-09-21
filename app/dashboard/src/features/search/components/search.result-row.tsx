import { HugeiconsIcon } from '@hugeicons/react'
import { Book01Icon, FileEditIcon, StudentsIcon } from '@hugeicons/core-free-icons'
import { Skeleton } from '#/components/ui/skeleton'
import { cn } from 'cn'
import type { SearchGroupType, SearchResultsItem } from '../search.types'

const GROUP_ICONS: Record<SearchGroupType, typeof Book01Icon> = {
  course: Book01Icon,
  lesson: FileEditIcon,
  student: StudentsIcon,
}

/**
 * A single result row (S-1.3). Rows deep-link via URL; `exists=false` targets
 * are rendered as muted rows with an explanatory affordance instead of a
 * broken navigation (plan §9-R5).
 */
export function SearchResultRow({
  item,
  onSelect,
}: {
  item: SearchResultsItem
  onSelect: (item: SearchResultsItem) => void
}) {
  const Icon = GROUP_ICONS[item.kind]

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors min-h-10',
        'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <HugeiconsIcon
        icon={Icon}
        size={18}
        strokeWidth={1.5}
        aria-hidden="true"
        className="shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{item.title}</span>
        {item.subtitle ? (
          <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
        ) : null}
      </span>
      {!item.exists ? (
        <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
          coming soon
        </span>
      ) : null}
    </button>
  )
}

export function SearchResultRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Skeleton className="size-5 rounded" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  )
}
