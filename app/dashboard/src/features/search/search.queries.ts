import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { getGlobalSearch } from './server/search.global'
import { SEARCH_MIN_LENGTH, normalizeSearchTerm } from './search.term'

export const searchQueryKeys = {
  global: (query: string) => ['search', 'global', query] as const,
}

/**
 * Query for the global search results (spec S-1.3), shared by the header
 * palette and the `/search` page so the two surfaces never disagree and share
 * one cache entry per term.
 *
 * - The key holds the **normalised** term, so `"lecture "` and `"lecture"`
 *   resolve to one entry instead of two.
 * - `enabled` mirrors the server validator's minimum length; a shorter term
 *   would be a guaranteed 400.
 * - `keepPreviousData` keeps the last results on screen while the next term
 *   loads. Without it every keystroke flips the view to its pending state and
 *   the page flashes an empty result set.
 */
export function globalSearchQueryOptions(query: string) {
  const term = normalizeSearchTerm(query)
  return queryOptions({
    queryKey: searchQueryKeys.global(term),
    queryFn: () => getGlobalSearch({ data: { query: term } }),
    enabled: term.length >= SEARCH_MIN_LENGTH,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: 1,
  })
}
