/**
 * Recent-search persistence for the global search palette (spec S-1.3).
 *
 * One implementation for the whole app: the palette and the results page read the
 * same list, so a term picked in one is offered by the other.
 *
 * Storage is browser-only, so every access is guarded and the module never
 * touches `localStorage` at import time. Reading during render is *not* safe:
 * the server would render an empty list and the client a populated one, which is
 * a hydration mismatch. `useRecentSearches` therefore hydrates in an effect.
 *
 * The storage handle is injectable so the rules can be exercised in tests
 * without a browser.
 */
import { SEARCH_MAX_LENGTH, SEARCH_RECENT_LIMIT, normalizeSearchTerm } from './search.term'

const STORAGE_KEY = 'abugida-recent-searches'

function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    // Blocked by privacy settings / disabled cookies — degrade to no recents.
    return null
  }
}

/** Recent terms, newest first, de-duplicated case-insensitively and capped. */
export function readRecentSearches(
  store: Pick<Storage, 'getItem'> | null = browserStorage(),
): string[] {
  if (!store) return []
  try {
    const raw: unknown = JSON.parse(store.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return dedupe(
      raw
        .filter((term): term is string => typeof term === 'string')
        .map(normalizeSearchTerm)
        .filter((term) => term.length > 0),
    )
  } catch {
    return []
  }
}

/**
 * Add a term to the front of the list, keeping it de-duplicated and capped.
 * Returns the stored list so the caller can update state from one source.
 */
export function rememberSearch(
  term: string,
  store: Pick<Storage, 'getItem' | 'setItem'> | null = browserStorage(),
): string[] {
  const next = dedupe([normalizeSearchTerm(term), ...readRecentSearches(store)])
  if (store) store.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function clearRecentSearches(
  store: Pick<Storage, 'removeItem'> | null = browserStorage(),
): void {
  store?.removeItem(STORAGE_KEY)
}

function dedupe(terms: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const term of terms) {
    const key = term.toLowerCase()
    if (term.length === 0 || term.length > SEARCH_MAX_LENGTH || seen.has(key)) continue
    seen.add(key)
    result.push(term)
    if (result.length >= SEARCH_RECENT_LIMIT) break
  }
  return result
}
