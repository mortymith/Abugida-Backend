import { toast } from 'sonner'
import type { useRouter } from '@tanstack/react-router'
import type { SearchResultsItem } from './search.types'

type AppRouter = ReturnType<typeof useRouter>

/**
 * Open a search result.
 *
 * `#/lib/entity-links` is the single registry that decides both the
 * destination path and whether the target route exists yet (modules land
 * progressively), so the URL is resolved there and navigation is driven from
 * `item.url` — a raw `history.push` is the only way to follow a registry path
 * without duplicating the route id and param name in a second place, where it
 * would silently drift when a route is added.
 *
 * Results whose route does not exist yet get an explanatory toast instead of a
 * navigation to nowhere (plan §9-R5).
 */
export function openSearchResult(router: AppRouter, item: SearchResultsItem): void {
  if (!item.exists) {
    toast.info(`“${item.title}” opens here once its module ships.`)
    return
  }
  void router.history.push(item.url)
}
