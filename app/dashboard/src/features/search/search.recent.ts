/**
 * Recent-search persistence for the global search palette (spec S-1.3).
 *
 * Storage is browser-only, so every access is guarded and the module never
 * touches `localStorage` at import time. Reading during render is *not* safe:
 * the server would render an empty list and the client a populated one, which
 * is a hydration mismatch. `useRecentSearches` therefore hydrates in an effect.
 */
import { SEARCH_MAX_LENGTH, SEARCH_RECENT_LIMIT, normalizeSearchTerm } from './search.term'

const STORAGE_KEY = 'abugida-recent-searches'

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    // Blocked by privacy settings / disabled cookies — degrade to no recents.
    return null
  }
}

/** Recent terms, newest first, de-duplicated case-insensitively and capped. */
export function readRecentSearches(): string[] {
  const store = storage()
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
export function rememberSearch(term: string): string[] {
  const next = dedupe([normalizeSearchTerm(term), ...readRecentSearches()])
  storage()?.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function clearRecentSearches(): void {
  storage()?.removeItem(STORAGE_KEY)
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
