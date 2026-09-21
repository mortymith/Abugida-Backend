import { useNavigate } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
import { HugeiconsIcon } from '@hugeicons/react'
import { AiSearch02Icon, ClockIcon } from '@hugeicons/core-free-icons'
import { useSearch } from '../hooks/navigation.search'
import { useState, useEffect } from 'react'

export function SearchTrigger() {
  const [open, setOpen] = useState(false)
  const { query, setQuery, results, isLoading, recentSearches } = useSearch()
  const navigate = useNavigate()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleSelect(result: { url: string }) {
    setOpen(false)
    navigate({ to: result.url as '/' | '/dashboard' })
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <HugeiconsIcon icon={AiSearch02Icon} strokeWidth={2} />
        <span className="hidden md:inline">Search...</span>
        <kbd className="pointer-events-none hidden rounded-md border bg-muted px-1.5 font-mono text-[10px] font-medium md:inline">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search courses, students, assets..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>{isLoading ? 'Searching...' : 'No results found.'}</CommandEmpty>

          {!query && recentSearches.length > 0 && (
            <CommandGroup heading="Recent">
              {recentSearches.map((term) => (
                <CommandItem
                  key={term}
                  value={term}
                  onSelect={() => {
                    setQuery(term)
                  }}
                >
                  <HugeiconsIcon icon={ClockIcon} strokeWidth={2} />
                  <span>{term}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.length > 0 && (
            <CommandGroup heading="Results">
              {results.map((result) => (
                <CommandItem
                  key={result.id}
                  value={result.title}
                  onSelect={() => handleSelect(result)}
                >
                  <span>{result.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{result.type}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
