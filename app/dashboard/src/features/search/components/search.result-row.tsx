import { Skeleton } from '#/components/ui/skeleton'
import { cn } from 'cn'
import { SearchGroupIcon } from './search.group-icon'
import type { SearchResultsItem } from '../search.types'

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
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={cn(
        'flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
        'hover:bg-muted focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-ring',
        !item.exists && 'text-muted-foreground',
      )}
    >
      <SearchGroupIcon kind={item.kind} className="size-[18px]" />
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
    <div className="flex items-center gap-3 px-3 py-2.5" aria-hidden="true">
      <Skeleton className="size-5 rounded" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  )
}
