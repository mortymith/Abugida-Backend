import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Search01Icon } from '@hugeicons/core-free-icons'
import { Button } from '#/components/ui/button'
import { trackNavEvent } from '#/features/navigation'
import { GlobalSearchDialog } from './search.command-dialog'

/**
 * Header entry point for global search (spec S-1.3 · S-7.5).
 *
 * The spec's rule is that **a shortcut is never the only route to an action**:
 * Android and keyboard-only users have no `⌘K`. So the affordance is a real,
 * visibly labelled **Search** button, and the `⌘K` chip beside it is decoration
 * (`aria-hidden`) that only hints at the shortcut. The keyboard shortcut is
 * still global — it reaches the palette from anywhere, including the item
 * editor — and the dialog's input carries a programmatic label.
 */
export function SearchTrigger() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return
      // ⌘K is a browser shortcut in a few contexts; always take it over.
      event.preventDefault()
      setOpen((previous) => {
        trackNavEvent('nav.palette_opened', { trigger: 'keyboard' })
        return !previous
      })
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-muted-foreground"
        aria-keyshortcuts="Meta+K Control+K"
        onClick={() => {
          trackNavEvent('nav.search_opened', { surface: 'header' })
          setOpen(true)
        }}
      >
        <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
        {/* Visually hidden below md — the accessible name never changes. */}
        <span className="hidden md:inline">Search</span>
        <span className="sr-only md:hidden">Search</span>
        {/* Hint only: the button above is the real, labelled route. */}
        <kbd
          aria-hidden="true"
          className="pointer-events-none hidden rounded-md border bg-muted px-1.5 font-mono text-[10px] font-medium md:inline"
        >
          ⌘K
        </kbd>
      </Button>

      <GlobalSearchDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
