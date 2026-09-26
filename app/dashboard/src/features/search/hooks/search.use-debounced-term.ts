import { useEffect, useState } from 'react'
import { SEARCH_DEBOUNCE_MS, normalizeSearchTerm } from '../search.term'

/**
 * Debounce a raw input value into a query-ready term.
 *
 * The palette queries on every keystroke otherwise: a 10-character term fires
 * 9 server round-trips, and the responses can land out of order. Debouncing
 * keeps one request per pause while `isPending` still gives immediate visual
 * feedback, so the input never feels laggy.
 *
 * The pending timer is cleared on change *and* on unmount — otherwise a query
 * scheduled just before the dialog closes still fires, and a stale term can
 * resolve after a newer one.
 */
export function useDebouncedSearchTerm(value: string, delayMs = SEARCH_DEBOUNCE_MS): string {
  const [debounced, setDebounced] = useState(normalizeSearchTerm(value))

  useEffect(() => {
    const term = normalizeSearchTerm(value)
    if (term === debounced) return

    const timer = setTimeout(() => setDebounced(term), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs, debounced])

  return debounced
}
