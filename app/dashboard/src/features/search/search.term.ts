/**
 * Search-term handling for the global search surfaces (spec S-1.3): the header
 * command palette and the `/search` results page.
 *
 * Two rules have to hold everywhere a term is used, so they live here instead
 * of being re-derived per surface:
 *
 * 1. **A term is only searchable from two characters** (`SEARCH_MIN_LENGTH`).
 *    The Zod validator on the server function (`search.global.ts`) rejects
 *    anything shorter, so a one-character query would be a guaranteed 400. The
 *    cap (`SEARCH_MAX_LENGTH`) matches the same validator and the `?q=` schema
 *    on the route.
 * 2. **A term is compared normalised** (trimmed + capped). A trailing space is
 *    a normal artefact of typing (`"lecture "`); without normalisation it
 *    becomes a distinct React Query cache entry and re-runs an identical
 *    query, and `isSearchTermChange` cannot tell a real refinement from noise.
 *
 * This module is pure so it stays unit-testable without a DOM, mirroring
 * `library.search-term.ts`.
 */

/** Minimum characters before a query is sent to the server. */
export const SEARCH_MIN_LENGTH = 2

/** Maximum characters the input accepts. Matches the server validator. */
export const SEARCH_MAX_LENGTH = 100

/** Debounce before a typed term is turned into a query. */
export const SEARCH_DEBOUNCE_MS = 250

/** How many recent searches are kept for the empty palette. */
export const SEARCH_RECENT_LIMIT = 5

/**
 * The canonical term for a raw input: trimmed and capped. Returns `''` when
 * there is nothing meaningful to search for.
 */
export function normalizeSearchTerm(raw: string | undefined): string {
  if (typeof raw !== 'string') return ''
  return raw.trim().slice(0, SEARCH_MAX_LENGTH)
}

/** Whether a term is long enough to be sent to the server. */
export function isSearchableTerm(term: string | undefined): boolean {
  return normalizeSearchTerm(term).length >= SEARCH_MIN_LENGTH
}

/**
 * Whether applying `next` would actually change the active term.
 *
 * Used to skip a fetch (and a query-cache entry) for input that normalises to
 * the term already in flight — e.g. a trailing space or a re-pasted term.
 */
export function isSearchTermChange(current: string | undefined, next: string | undefined): boolean {
  return normalizeSearchTerm(current) !== normalizeSearchTerm(next)
}
