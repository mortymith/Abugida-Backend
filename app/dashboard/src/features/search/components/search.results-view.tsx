import { useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { globalSearchQueryOptions } from '../search.queries'
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

  function handleSelect(item: SearchResultsItem) {
    if (!item.exists) {
      // Target route belongs to a future spec module — inform, don't 404.
      toast.info(`“${item.title}” opens here once its module ships.`)
      return
    }
    router.history.push(item.url)
  }

  if (searchQuery.isLoading) {
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
        onRetry={() => searchQuery.refetch()}
      />
    )
  }

  const payload = searchQuery.data

  if (!payload || payload.totalMatches === 0) {
    return <EmptyState title={`No results for “${query}”.`} description="Try a different term." />
  }

  const visibleGroups =
    tab === 'all' ? payload.groups : payload.groups.filter((group) => group.kind === tab)

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as SearchTab)}
        aria-label="Filter results by type"
      >
        <TabsList>
          <TabsTrigger value="all">All ({payload.totalMatches})</TabsTrigger>
          {payload.groups.map((group) => (
            <TabsTrigger key={group.kind} value={group.kind}>
              {group.label} ({group.total})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {visibleGroups.map((group) => (
        <section key={group.kind} aria-label={`${group.label} results`} className="space-y-1">
          <h2 className="px-1 text-sm font-semibold text-muted-foreground">{group.label}</h2>
          {group.items.map((item) => (
            <SearchResultRow key={`${item.kind}-${item.id}`} item={item} onSelect={handleSelect} />
          ))}
        </section>
      ))}
    </div>
  )
}
