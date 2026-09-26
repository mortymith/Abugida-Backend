import { LIBRARY_SEARCH_MAX_LENGTH } from './schemas/library.schema'

/**
 * Search-term handling for the Content Library search box (spec 05 S-3.1).
 *
 * The box used to be a *pure* controlled input — `value={search.q ?? ''}`
 * straight from the URL — and every keystroke navigated. That is broken in two
 * ways:
 *
 * 1. The rendered value only changes once the router has committed a
 *    navigation. A keystroke is therefore dropped whenever the pending
 *    navigation is superseded by the next one (i.e. typing faster than the
 *    route loader commits), so the box silently swallows characters mid-word.
 * 2. Each keystroke pushed a history entry and re-ran the route loader (four
 *    `ensureQueryData` calls) for a one-character refinement.
 *
 * The fix is a local draft state that commits to the URL on a debounce and on
 * Enter (`LibrarySearchInput`). This module owns the pure part of that
 * contract — what actually gets written to `?q=` — so it is unit-testable
 * without a DOM. The cap lives in `library.schema.ts` next to the Zod schema
 * so the input and `libraryListQuerySchema` can never drift.
 */

/**
 * Max characters the input accepts. Re-exported from the schema module so the
 * field and `libraryListQuerySchema` cannot drift.
 */
export { LIBRARY_SEARCH_MAX_LENGTH }

/** Debounce before a draft term is committed to the URL. */
export const LIBRARY_SEARCH_DEBOUNCE_MS = 300

/**
 * The `?q=` value for a raw input: trimmed, capped, and `undefined` when there
 * is nothing to search for.
 *
 * Trimming matters because a trailing space is a normal artefact of typing
 * (`"lecture "`), and it must not become a distinct React Query cache entry
 * that re-runs an identical query. `undefined` (not `''`) is what clears the
 * param — see `patchSearch` in the route.
 */
export function normalizeLibrarySearchTerm(raw: string | undefined): string | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim().slice(0, LIBRARY_SEARCH_MAX_LENGTH)
  return trimmed === '' ? undefined : trimmed
}

/**
 * Whether committing `draft` would actually change the applied `?q=`.
 *
 * Used to skip a navigation (and therefore a history entry and a query) for
 * input that normalises to the term already applied — e.g. the user typed a
 * trailing space, or pasted the query that is already in the URL.
 */
export function isLibrarySearchTermChange(current: string | undefined, draft: string): boolean {
  return normalizeLibrarySearchTerm(current) !== normalizeLibrarySearchTerm(draft)
}
