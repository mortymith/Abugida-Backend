import { useCallback, useRef, useState } from 'react'

interface SearchResult {
  id: string
  title: string
  type: 'course' | 'student' | 'asset'
  url: string
}

interface UseSearchReturn {
  query: string
  setQuery: (query: string) => void
  results: SearchResult[]
  isLoading: boolean
  recentSearches: string[]
  clearRecent: () => void
}

export function useSearch(): UseSearchReturn {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      return JSON.parse(localStorage.getItem('abugida-recent-searches') ?? '[]')
    } catch {
      return []
    }
  })

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handlesetQuery = useCallback((value: string) => {
    setQuery(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value.trim()) {
      setResults([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    debounceRef.current = setTimeout(async () => {
      // TODO: Wire to real search API
      // For now, simulate empty results
      setResults([])
      setIsLoading(false)

      // Save to recent searches
      if (value.trim().length > 2) {
        setRecentSearches((prev) => {
          const updated = [value, ...prev.filter((s) => s !== value)].slice(0, 5)
          localStorage.setItem('abugida-recent-searches', JSON.stringify(updated))
          return updated
        })
      }
    }, 300)
  }, [])

  const clearRecent = useCallback(() => {
    setRecentSearches([])
    localStorage.removeItem('abugida-recent-searches')
  }, [])

  return {
    query,
    setQuery: handlesetQuery,
    results,
    isLoading,
    recentSearches,
    clearRecent,
  }
}
