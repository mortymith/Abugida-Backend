import type { ReactNode } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'

/**
 * S-7.5 Command Palette — generic, keyboard-driven launcher shell (spec 09).
 *
 * Presentation + interaction only: grouping, matching, and pending/empty
 * states. Callers own the item sources (screen navigation, quick actions,
 * search results) so no feature logic can leak into the shell. Matching is
 * delegated to the underlying command primitive via `CommandPalette.value`.
 */
export interface CommandPaletteItem {
  id: string
  label: string
  /** Extra match terms beyond the label (e.g. route path, synonyms). */
  keywords?: string
  /** Muted, right-aligned context (entity kind, keyboard hint). */
  hint?: string
  icon?: ReactNode
  onSelect: () => void
}

export interface CommandPaletteGroup {
  id: string
  heading: string
  items: CommandPaletteItem[]
}

/** Stable match value for the command primitive (label + keywords). */
export function commandItemValue(item: Pick<CommandPaletteItem, 'label' | 'keywords'>): string {
  return item.keywords ? `${item.label} ${item.keywords}` : item.label
}

export function CommandPalette({
  open,
  onOpenChange,
  placeholder = 'Type a command or search…',
  groups,
  isLoading = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  placeholder?: string
  groups: CommandPaletteGroup[]
  isLoading?: boolean
}) {
  const rendered = groups.filter((group) => group.items.length > 0)

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command Palette"
      description="Search screens, actions, and content. Escape closes."
    >
      <CommandInput placeholder={placeholder} aria-label="Command palette search" />
      <CommandList>
        {/*
          cmdk renders Empty only when zero items match the current query and
          hides groups whose items are all filtered out, so Empty stays mounted.
        */}
        <CommandEmpty>
          {isLoading ? 'Searching…' : 'No matches. Try a different term.'}
        </CommandEmpty>
        {rendered.map((group) => (
          <CommandGroup key={group.id} heading={group.heading}>
            {group.items.map((item) => (
              <CommandItem
                key={item.id}
                value={commandItemValue(item)}
                onSelect={() => item.onSelect()}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.hint ? (
                  <span className="ml-auto text-xs text-muted-foreground">{item.hint}</span>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
