import { useQuery } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon, ClockIcon, Search01Icon } from '@hugeicons/core-free-icons'
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '#/components/ui/command'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { globalSearchQueryOptions } from '../search.queries'
import { openSearchResult } from '../search.navigate'
import { SEARCH_GROUP_LABELS, SEARCH_RESULT_LIMIT } from '../search.types'
import { SEARCH_MAX_LENGTH, isSearchableTerm, normalizeSearchTerm } from '../search.term'
import { useDebouncedSearchTerm } from '../hooks/search.use-debounced-term'
import { useRecentSearches } from '../hooks/search.use-recent-searches'
import { SearchGroupIcon } from './search.group-icon'
import type { SearchResultsItem } from '../search.types'

/**
 * Global search palette (spec S-1.3), opened from the header with ⌘K / Ctrl+K.
 *
 * This replaces a stub hook that only debounced a keystroke into a hard-coded
 * empty result list, so the header search never found anything even though the
 * server function, the query, and the `/search` page all already existed. The
 * palette now runs the same `globalSearchQueryOptions` query the results page
 * uses, so both surfaces share one cache and cannot disagree.
 *
 * Behaviour worth keeping:
 *
 * - **Debounced, not per-keystroke.** A term is sent only once it is at least
 *   `SEARCH_MIN_LENGTH` characters (shorter is rejected by the server
 *   validator) and after a pause: one query per pause, not one per key.
 * - **No client-side re-filtering.** `shouldFilter={false}` — results are
 *   already filtered by the server, and cmdk's substring pass would drop hits
 *   that were matched in a description, tag, or transcript.
 * - **Recents are hydrated in an effect**, never during render, so SSR and the
 *   first client paint agree (reading `localStorage` in a state initialiser
 *   caused a hydration mismatch).
 * - **Role-gated groups** (`payload.omittedGroups`) are surfaced as a note, so
 *   a permission-gated group is never mistaken for "nothing exists".
 */
export function GlobalSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [term, setTerm] = useState('')
  const debouncedTerm = useDebouncedSearchTerm(term)
  const router = useRouter()
  const navigate = useNavigate()
  const { recent, remember, clear } = useRecentSearches()

  const query = useQuery(globalSearchQueryOptions(debouncedTerm))
  const typed = normalizeSearchTerm(term)
  // Branching on what was *typed* (not on the debounced term) means the panel
  // reacts instantly: clearing the box falls back to recents at once, and a
  // second character shows a loading state instead of the previous term's
  // results being presented as the answer to a question not asked yet.
  const isSearchable = isSearchableTerm(typed)
  const payload = query.data
  const groups = payload?.groups ?? []
  // The visible term and the fetched term differ for two windows: the debounce,
  // and the minimum length. `keepPreviousData` in the query options means
  // `isPending` is true only for a first load, so it never flashes a skeleton
  // over results that are already on screen.
  const settling = typed !== debouncedTerm
  const showSkeleton =
    query.isPending || (settling && !isSearchableTerm(debouncedTerm) && groups.length === 0)

  // Re-opening starts from a clean slate, otherwise the previous term and its
  // results greet the user every time.
  useEffect(() => {
    if (!open) setTerm('')
  }, [open])

  function handleSelect(item: SearchResultsItem) {
    // The term that produced these results, not the newest keystroke — the
    // results may still belong to the previous term mid-debounce.
    remember(debouncedTerm)
    openSearchResult(router, item)
    onOpenChange(false)
  }

  function handleViewAll() {
    if (!isSearchable) return
    remember(typed)
    onOpenChange(false)
    void navigate({ to: '/search', search: { q: typed } })
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search courses, lessons, assets, and students."
      className="sm:max-w-xl"
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search courses, lessons, assets, students…"
          aria-label="Search"
          value={term}
          onValueChange={setTerm}
          autoComplete="off"
          spellCheck={false}
          maxLength={SEARCH_MAX_LENGTH}
        />
        <CommandList>
          {!isSearchable ? (
            <RecentSearches terms={recent} onPick={setTerm} onClear={clear} />
          ) : query.isError && !settling ? (
            <CommandGroup>
              <CommandItem
                value="retry-search"
                onSelect={() => void query.refetch()}
                className="text-destructive"
              >
                <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
                <span>Search failed. Select to retry.</span>
              </CommandItem>
            </CommandGroup>
          ) : showSkeleton ? (
            <SearchSkeleton />
          ) : groups.length === 0 ? (
            // Not `CommandEmpty`: the "see all results" item below is always in
            // the list, so cmdk never considers the list empty and would hide
            // the message.
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results for “{typed}”.
            </p>
          ) : (
            <>
              {groups.map((group) => (
                <CommandGroup
                  key={group.kind}
                  heading={`${SEARCH_GROUP_LABELS[group.kind]} (${group.total})`}
                >
                  {group.items.map((item) => (
                    <CommandItem
                      key={`${item.kind}-${item.id}`}
                      // cmdk matches keyboard navigation against `value`, so the
                      // subtitle is included — ↓ can then reach a hit by context.
                      value={`${item.title} ${item.subtitle ?? ''}`.trim()}
                      onSelect={() => handleSelect(item)}
                    >
                      <SearchGroupIcon kind={item.kind} />
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      {item.subtitle ? (
                        <span className="max-w-[45%] truncate text-xs text-muted-foreground">
                          {item.subtitle}
                        </span>
                      ) : null}
                      {!item.exists ? (
                        <span className="shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          soon
                        </span>
                      ) : null}
                    </CommandItem>
                  ))}
                  {group.total >= SEARCH_RESULT_LIMIT ? (
                    <p className="px-3 py-1.5 text-xs text-muted-foreground">
                      Showing the first {SEARCH_RESULT_LIMIT} — refine the term to narrow it down.
                    </p>
                  ) : null}
                </CommandGroup>
              ))}
            </>
          )}

          {/* Results on screen can lag the input by a debounce or a round trip;
              say so rather than looking stale or complete. */}
          {isSearchable && (settling || query.isFetching) ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
          ) : null}

          {/* Role-gated groups are surfaced so a permission boundary is never
              read as "nothing exists". */}
          {payload && payload.omittedGroups.length > 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Not searched:{' '}
              {payload.omittedGroups.map((group) => SEARCH_GROUP_LABELS[group.kind]).join(', ')} —
              not available for your role.
            </p>
          ) : null}

          {/* Always offered — the results page is linkable and works even when
              the palette request failed. */}
          {isSearchable ? (
            <>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem value="view-all-results" onSelect={handleViewAll}>
                  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                  <span>See all results for “{typed}”</span>
                </CommandItem>
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

function RecentSearches({
  terms,
  onPick,
  onClear,
}: {
  terms: string[]
  onPick: (term: string) => void
  onClear: () => void
}) {
  if (terms.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <HugeiconsIcon
          icon={Search01Icon}
          strokeWidth={1.5}
          className="size-6 text-muted-foreground"
        />
        <p className="text-sm text-muted-foreground">
          Search across courses, lessons, assets, and students.
        </p>
      </div>
    )
  }

  return (
    <CommandGroup heading="Recent">
      {terms.map((term) => (
        <CommandItem key={term} value={term} onSelect={() => onPick(term)}>
          <HugeiconsIcon icon={ClockIcon} strokeWidth={2} />
          <span className="truncate">{term}</span>
        </CommandItem>
      ))}
      <div className="flex justify-end px-2 pb-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-muted-foreground"
          onClick={onClear}
        >
          Clear recent
        </Button>
      </div>
    </CommandGroup>
  )
}

function SearchSkeleton() {
  return (
    <CommandGroup aria-label="Searching" className="gap-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex items-center gap-2 px-3 py-2" aria-hidden="true">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </CommandGroup>
  )
}
