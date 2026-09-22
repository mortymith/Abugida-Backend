import { useNavigate } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { CommandPalette } from '#/components/common/command-palette'
import type { CommandPaletteGroup } from '#/components/common/command-palette'
import { HugeiconsIcon } from '@hugeicons/react'
import { AiSearch02Icon, ClockIcon } from '@hugeicons/core-free-icons'
import { useRole } from '#/features/auth'
import type { GlobalSearchPayload } from '#/features/search'
import { useCommandPalette } from '../hooks/navigation.command-palette'
import {
  buildNavigationGroup,
  buildQuickActionGroup,
  buildResultsGroup,
  PALETTE_GROUP_IDS,
} from '../navigation.palette'

const EMPTY_PAYLOAD: GlobalSearchPayload = {
  query: '',
  groups: [],
  totalMatches: 0,
  omittedGroups: [],
}

/**
 * S-7.5 Command Palette trigger (spec 09). Header search button + the
 * ⌘K palette: quick actions, role-filtered screen navigation, recent
 * searches, and live results from the S-1.3 global-search index.
 */
export function SearchTrigger() {
  const navigate = useNavigate()
  const role = useRole()

  const palette = useCommandPalette()

  const onNavigate = (to: string, search?: Record<string, unknown>) => {
    palette.closeAndReset()
    void navigate({ to, search: search as never })
  }

  const groups: CommandPaletteGroup[] = [
    buildQuickActionGroup((to, search) => onNavigate(to, search)),
    buildNavigationGroup(role, (to) => onNavigate(to)),
  ]

  if (!palette.query.trim() && palette.recentSearches.length > 0) {
    groups.push({
      id: PALETTE_GROUP_IDS.recent,
      heading: 'Recent searches',
      items: palette.recentSearches.map((term) => ({
        id: `recent:${term}`,
        label: term,
        hint: 'Recent',
        icon: <HugeiconsIcon icon={ClockIcon} strokeWidth={2} />,
        onSelect: () => palette.selectRecent(term),
      })),
    })
  }

  const payload = palette.search.data ?? EMPTY_PAYLOAD
  groups.push(
    buildResultsGroup(payload, (url) => {
      palette.recordSearchTerm(palette.query)
      onNavigate(url)
    }),
  )

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-muted-foreground"
        onClick={() => palette.setOpen(true)}
        aria-label="Open command palette"
        aria-keyshortcuts="Meta+K Control+K"
      >
        <HugeiconsIcon icon={AiSearch02Icon} strokeWidth={2} />
        <span className="hidden md:inline">Search...</span>
        <kbd className="pointer-events-none hidden rounded-md border bg-muted px-1.5 font-mono text-[10px] font-medium md:inline">
          ⌘K
        </kbd>
      </Button>

      <CommandPalette
        open={palette.open}
        onOpenChange={(next) => (next ? palette.setOpen(true) : palette.closeAndReset())}
        placeholder="Type a command or search…"
        groups={groups}
        isLoading={palette.isSearching}
      />
    </>
  )
}
