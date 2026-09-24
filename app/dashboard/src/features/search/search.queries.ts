import { queryOptions } from '@tanstack/react-query'
import { getGlobalSearch } from './server/search.global'

export const searchQueryKeys = {
  global: (query: string) => ['search', 'global', query] as const,
}

export function globalSearchQueryOptions(query: string) {
  return queryOptions({
    queryKey: searchQueryKeys.global(query),
    queryFn: () => getGlobalSearch({ data: { query } }),
    enabled: query.trim().length >= 2,
    staleTime: 15_000,
  })
}
