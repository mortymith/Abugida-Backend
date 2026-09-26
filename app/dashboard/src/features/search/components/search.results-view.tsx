import { useQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { globalSearchQueryOptions } from '../search.queries'
import { openSearchResult } from '../search.navigate'
import { SEARCH_GROUP_LABELS, SEARCH_RESULT_LIMIT } from '../search.types'
import { SearchResultRow, SearchResultRowSkeleton } from './search.result-row'
import type { SearchGroupType, SearchResultsItem } from '../search.types'

type SearchTab = SearchGroupType | 'all'

/**
 * S-1.3 Global Search Results: grouped, ranked results with entity-type tabs
 * (counts included). Refining the query updates the URL param without
 * leaving the page.
 */
export function GlobalSearchResults({ query }: { query: string }) {
  const [tab, setTab] = useState<SearchTab>('all')
  const router = useRouter()
  const searchQuery = useQuery(globalSearchQueryOptions(query))

  const payload = searchQuery.data
  const groups = payload?.groups ?? []
  // `keepPreviousData` in the query options keeps the last results on screen
  // while a new term loads, so `isPending` only covers the first load.
  const showSkeleton = searchQuery.isPending

  // A new term can legitimately have no results for the selected tab (e.g.
  // "algebra" matched courses, "geometry" only lessons). Falling back to
  // "all" keeps the page from rendering an unexplained blank area.
  useEffect(() => {
    if (tab === 'all') return
    if (!groups.some((group) => group.kind === tab)) setTab('all')
  }, [groups, tab])

  if (showSkeleton) {
    return (
      <div aria-busy="true" aria-label="Loading search results">
        {Array.from({ length: 6 }).map((_, index) => (
          <SearchResultRowSkeleton key={index} />
        ))}
      </div>
    )
  }

  if (searchQuery.isError) {
    return (
      <RetryErrorState
        title="Unable to load search results. Retry?"
        onRetry={() => void searchQuery.refetch()}
        isRetrying={searchQuery.isFetching}
      />
    )
  }

  if (!payload || payload.totalMatches === 0) {
    return (
      <EmptyState
        title={`No results for “${query}”.`}
        description="Try a different term."
        action={
          payload && payload.omittedGroups.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Not searched:{' '}
              {payload.omittedGroups.map((group) => SEARCH_GROUP_LABELS[group.kind]).join(', ')}{' '}
              (not available for your role).
            </p>
          ) : null
        }
      />
    )
  }

  const visibleGroups = tab === 'all' ? groups : groups.filter((group) => group.kind === tab)

  function handleSelect(item: SearchResultsItem) {
    openSearchResult(router, item)
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={(value) => setTab(value as SearchTab)}>
        <TabsList aria-label="Filter results by type">
          <TabsTrigger value="all">All ({payload.totalMatches})</TabsTrigger>
          {groups.map((group) => (
            <TabsTrigger key={group.kind} value={group.kind}>
              {SEARCH_GROUP_LABELS[group.kind]} ({group.total})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {visibleGroups.map((group) => (
        <section key={group.kind} aria-label={`${group.label} results`} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 px-1">
            <h2 className="text-sm font-semibold text-muted-foreground">{group.label}</h2>
            {group.total >= SEARCH_RESULT_LIMIT ? (
              <p className="text-xs text-muted-foreground">
                Showing the first {SEARCH_RESULT_LIMIT} of many matches
              </p>
            ) : null}
          </div>
          {group.items.map((item) => (
            <SearchResultRow key={`${item.kind}-${item.id}`} item={item} onSelect={handleSelect} />
          ))}
        </section>
      ))}

      {payload.omittedGroups.length > 0 ? (
        <p className="px-1 text-xs text-muted-foreground">
          Not searched:{' '}
          {payload.omittedGroups.map((group) => SEARCH_GROUP_LABELS[group.kind]).join(', ')} — not
          available for your role.
        </p>
      ) : null}
    </div>
  )
}
