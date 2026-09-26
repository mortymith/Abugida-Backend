import { useCallback, useEffect, useState } from 'react'
import { clearRecentSearches, readRecentSearches, rememberSearch } from '../search.recent'
import { normalizeSearchTerm } from '../search.term'

/**
 * Recent searches for the empty state of the global search palette.
 *
 * Hydrated in an effect rather than a `useState` initialiser: the initialiser
 * runs during SSR too, so the server would render an empty list and the client
 * a populated one — a hydration mismatch that also made the previous
 * implementation flash.
 */
export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    setRecent(readRecentSearches())
  }, [])

  const remember = useCallback((term: string) => {
    const normalized = normalizeSearchTerm(term)
    if (!normalized) return
    setRecent(rememberSearch(normalized))
  }, [])

  const clear = useCallback(() => {
    clearRecentSearches()
    setRecent([])
  }, [])

  return { recent, remember, clear }
}
