import { useEffect, useId, useRef, useState } from 'react'
import { Input } from '#/components/ui/input'
import {
  isLibrarySearchTermChange,
  LIBRARY_SEARCH_DEBOUNCE_MS,
  LIBRARY_SEARCH_MAX_LENGTH,
  normalizeLibrarySearchTerm,
} from '../library.search-term'

/**
 * Content Library search box (spec 05 S-3.1 — "Search assets, tags,
 * descriptions…").
 *
 * The draft lives in local state and is committed to the URL on a debounce
 * (and immediately on Enter / blur), which fixes three defects of the previous
 * URL-controlled implementation:
 *
 * - **Dropped characters.** `value` was bound straight to `?q=`, so the field
 *   only repainted once the router committed a navigation. Typing faster than
 *   the route loader meant superseded navigations and lost keystrokes.
 * - **One navigation per keystroke.** Every character pushed a history entry
 *   and re-ran the route loader; Back then walked backwards one letter at a
 *   time. Commits here pass `replace`, so refining in place is a single
 *   history entry (the router's `navigate` is called by the parent).
 * - **Duplicated empty-query fetches.** A trailing space or a re-pasted term
 *   normalised to the same value is not re-committed at all.
 *
 * The applied term is still the URL, so the view stays linkable and the
 * back/forward buttons keep working; an external change (Clear filters, a
 * breadcrumb folder change, popstate) re-syncs the draft through the effect
 * below.
 */
export function LibrarySearchInput({
  value,
  onCommit,
  placeholder = 'Search assets, tags, descriptions…',
  label = 'Search assets',
  className = 'max-w-xs',
}: {
  /** The applied term, i.e. the route's `search.q`. */
  value: string | undefined
  /** Called with the normalised term (`undefined` clears the filter). */
  onCommit: (term: string | undefined) => void
  placeholder?: string
  /** Accessible name of the field. */
  label?: string
  /** Layout for the field wrapper. */
  className?: string
}) {
  const [draft, setDraft] = useState(value ?? '')
  const inputId = useId()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Read inside the timer so the debounce always compares against the term
  // currently in the URL, not the value captured when the timer was scheduled.
  const appliedRef = useRef(value)
  appliedRef.current = value

  // Re-sync when the applied term changes from outside the field (Clear filters,
  // a folder chip, popstate). The pending debounce is dropped too, otherwise a
  // stale draft would be re-committed over the newer value a moment later.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setDraft(value ?? '')
  }, [value])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function commit(next: string) {
    clearTimer()
    if (!isLibrarySearchTermChange(appliedRef.current, next)) return
    onCommit(normalizeLibrarySearchTerm(next))
  }

  function handleChange(next: string) {
    setDraft(next)
    clearTimer()
    const normalized = normalizeLibrarySearchTerm(next)
    if (normalized === normalizeLibrarySearchTerm(appliedRef.current)) return
    timerRef.current = setTimeout(() => commit(next), LIBRARY_SEARCH_DEBOUNCE_MS)
  }

  return (
    <form
      role="search"
      className={className}
      onSubmit={(event) => {
        // Enter searches immediately instead of waiting out the debounce.
        event.preventDefault()
        commit(draft)
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <Input
        id={inputId}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={draft}
        autoComplete="off"
        spellCheck={false}
        maxLength={LIBRARY_SEARCH_MAX_LENGTH}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          // Escape clears the box (native `type=search` also does this, but the
          // change event is not guaranteed to fire before the commit check).
          event.preventDefault()
          clearTimer()
          setDraft('')
          if (isLibrarySearchTermChange(value, '')) onCommit(undefined)
        }}
      />
    </form>
  )
}
