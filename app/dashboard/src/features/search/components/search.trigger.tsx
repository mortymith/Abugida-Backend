import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Search01Icon } from '@hugeicons/core-free-icons'
import { Button } from '#/components/ui/button'
import { GlobalSearchDialog } from './search.command-dialog'

/**
 * Header entry point for global search (spec S-1.3): the button plus the ⌘K /
 * Ctrl+K listener that opens the palette from anywhere in the app.
 *
 * The listener is attached once, ignores keystrokes typed inside a text field
 * (so ⌘K in an input still opens the palette but a plain `k` never hijacks
 * typing), and toggles so the shortcut also closes it.
 */
export function SearchTrigger() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return
      // ⌘K is a browser shortcut in a few contexts; always take it over.
      event.preventDefault()
      setOpen((previous) => !previous)
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
        onClick={() => setOpen(true)}
      >
        <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
        <span className="hidden md:inline">Search…</span>
        <kbd className="pointer-events-none hidden rounded-md border bg-muted px-1.5 font-mono text-[10px] font-medium md:inline">
          ⌘K
        </kbd>
      </Button>

      <GlobalSearchDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
