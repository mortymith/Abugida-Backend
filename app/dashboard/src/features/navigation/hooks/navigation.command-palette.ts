import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { globalSearchQueryOptions } from '#/features/search'
import {
  readRecentSearches,
  rememberSearchTerm,
  RECENT_SEARCHES_LIMIT,
} from '../navigation.palette'

const QUERY_DEBOUNCE_MS = 250
/** Spec S-1.3 index contract: queries shorter than 2 characters do not search. */
const MIN_QUERY_LENGTH = 2

/**
 * S-7.5 Command Palette state: ⌘K/ctrl-K binding, recent searches
 * (localStorage, most-recent-first), and a debounced query wired to the
 * real global-search server function (same index as the S-1.3 results
 * page). Presentation lives in the shared CommandPalette shell.
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Refresh recents when the palette opens so other tabs' entries appear.
  useEffect(() => {
    if (!open) return
    setRecentSearches(readRecentSearches(window.localStorage))
  }, [open])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setDebouncedQuery('')
      return
    }
    debounceRef.current = setTimeout(() => setDebouncedQuery(trimmed), QUERY_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const search = useQuery(globalSearchQueryOptions(debouncedQuery))

  const selectRecent = useCallback((term: string) => {
    setQuery(term)
  }, [])

  const recordSearchTerm = useCallback((term: string) => {
    rememberSearchTerm(window.localStorage, term)
    setRecentSearches(readRecentSearches(window.localStorage))
  }, [])

  const closeAndReset = useCallback(() => {
    setOpen(false)
    setQuery('')
    setDebouncedQuery('')
  }, [])

  return {
    open,
    setOpen,
    closeAndReset,
    query,
    setQuery,
    recentSearches,
    selectRecent,
    recordSearchTerm,
    search,
    isSearching: search.isFetching || (query.trim().length >= MIN_QUERY_LENGTH && search.isPending),
    recentLimit: RECENT_SEARCHES_LIMIT,
  }
}
