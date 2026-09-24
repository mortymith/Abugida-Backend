import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { GlobalSearchResults, globalSearchQueryOptions } from '#/features/search'

const searchRouteSchema = z.object({
  q: z.string().trim().max(100).optional(),
})

export const Route = createFileRoute('/_app/search')({
  validateSearch: searchRouteSchema,
  loaderDeps: ({ search }) => ({ q: search.q ?? '' }),
  loader: ({ context, deps }) => {
    if (deps.q.trim().length < 2) return null
    // Warm the search cache server-side; component query renders states.
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
  const query = (search.q ?? '').trim()

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {query ? (
            <>
              Results for <span className="text-primary">“{query}”</span>
            </>
          ) : (
            'Search'
          )}
        </h1>
      </div>

      <Card className="py-6">
        <CardHeader className="px-6">
          <CardTitle className="sr-only">Search results</CardTitle>
        </CardHeader>
        <CardContent className="px-3">
          {query.trim().length < 2 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Type at least two characters to search across courses, lessons, and students.
            </p>
          ) : (
            <GlobalSearchResults query={query} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
