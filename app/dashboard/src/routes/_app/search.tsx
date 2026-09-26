import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import {
  GlobalSearchInput,
  GlobalSearchResults,
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
  globalSearchQueryOptions,
  normalizeSearchTerm,
} from '#/features/search'

const searchRouteSchema = z.object({
  q: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
})

export const Route = createFileRoute('/_app/search')({
  validateSearch: searchRouteSchema,
  loaderDeps: ({ search }) => ({ q: normalizeSearchTerm(search.q) }),
  loader: ({ context, deps }) => {
    if (deps.q.length < SEARCH_MIN_LENGTH) return null
    // Warm the search cache server-side; the component query renders states.
    return Promise.allSettled([
      context.queryClient.ensureQueryData(globalSearchQueryOptions(deps.q)),
    ])
  },
  component: GlobalSearchPage,
})

/**
 * S-1.3 Global Search Results — unified results for the header search bar.
 * The query lives in the `q` search param so refining never leaves the page.
 */
function GlobalSearchPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const query = normalizeSearchTerm(search.q)

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          {query ? (
            <>
              Results for <span className="text-primary">“{query}”</span>
            </>
          ) : (
            'Search'
          )}
        </h1>
        <GlobalSearchInput
          value={query}
          // `replace` so refining in place is a single history entry.
          onCommit={(term) => {
            void navigate({ to: '/search', search: { q: term || undefined }, replace: true })
          }}
        />
      </div>

      <Card className="py-6">
        <CardHeader className="px-6">
          <CardTitle className="sr-only">Search results</CardTitle>
        </CardHeader>
        <CardContent className="px-3">
          {query.length < SEARCH_MIN_LENGTH ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Type at least {SEARCH_MIN_LENGTH} characters to search across courses, lessons, and
              students.
            </p>
          ) : (
            <GlobalSearchResults query={query} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
