import { useEffect, useId, useRef, useState } from 'react'
import { Input } from '#/components/ui/input'
import {
  SEARCH_DEBOUNCE_MS,
  SEARCH_MAX_LENGTH,
  isSearchTermChange,
  normalizeSearchTerm,
} from '../search.term'

/**
 * Refine box for the `/search` results page.
 *
 * Mirrors the Content Library search field: the draft lives in local state and
 * is committed to `?q=` on a debounce (and immediately on Enter / blur). Binding
 * `value` straight to the URL instead would drop keystrokes whenever the
 * pending navigation was superseded by the next one, and would push a history
 * entry per character so Back walked backwards one letter at a time.
 *
 * The applied term stays the URL, so the view remains linkable and back/forward
 * keep working; an external change (back button, the header palette) re-syncs
 * the draft through the effect below.
 */
export function GlobalSearchInput({
  value,
  onCommit,
  className = 'max-w-sm',
}: {
  /** The applied term, i.e. the route's `search.q`. */
  value: string
  /** Called with the normalised term; `''` clears the filter. */
  onCommit: (term: string) => void
  className?: string
}) {
  const [draft, setDraft] = useState(value)
  const inputId = useId()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Read inside the timer so the debounce always compares against the term
  // currently in the URL, not the one captured when the timer was scheduled.
  const appliedRef = useRef(value)
  appliedRef.current = value

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setDraft(value)
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
    if (!isSearchTermChange(appliedRef.current, next)) return
    onCommit(normalizeSearchTerm(next))
  }

  function handleChange(next: string) {
    setDraft(next)
    clearTimer()
    if (!isSearchTermChange(appliedRef.current, next)) return
    timerRef.current = setTimeout(() => commit(next), SEARCH_DEBOUNCE_MS)
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
        Refine search
      </label>
      <Input
        id={inputId}
        type="search"
        aria-label="Refine search"
        placeholder="Refine search…"
        value={draft}
        autoComplete="off"
        spellCheck={false}
        maxLength={SEARCH_MAX_LENGTH}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          event.preventDefault()
          clearTimer()
          setDraft('')
          if (isSearchTermChange(value, '')) onCommit('')
        }}
      />
    </form>
  )
}
