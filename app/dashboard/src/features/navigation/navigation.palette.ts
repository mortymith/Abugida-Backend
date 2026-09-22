import type { CommandPaletteGroup } from '#/components/common/command-palette'
import type { GlobalSearchPayload, SearchResultsItem } from '#/features/search'
import { NAV_ITEMS } from './navigation.config'
import type { NavItem } from './navigation.config'

/**
 * S-7.5 Command Palette data assembly (spec 09).
 *
 * Pure builders that turn app sources — sidebar navigation, quick actions,
 * and the S-1.3 global-search index — into palette groups. No fetching and
 * no routing happens here; callers supply handlers so the builders stay
 * trivially testable and reusable.
 */

export const PALETTE_GROUP_IDS = {
  actions: 'actions',
  navigation: 'navigation',
  results: 'results',
  recent: 'recent',
} as const

/** Spec S-7.5 quick actions ("Create Course", "Invite Team Member", …). */
export interface QuickAction {
  id: string
  label: string
  keywords?: string
  /** Screen the action opens; empty when the action only navigates. */
  to: string
  search?: Record<string, unknown>
}

/**
 * Quick actions are route-backed entries; they exist only if the target
 * screen is implemented, so palette items never dead-end.
 */
export const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    id: 'create-course',
    label: 'Create Course',
    keywords: 'new course blank template wizard',
    to: '/courses/new',
    search: { step: 1 },
  },
  {
    id: 'invite-team-member',
    label: 'Invite Team Member',
    keywords: 'team member invite settings organization',
    to: '/settings/team',
  },
  {
    id: 'upload-asset',
    label: 'Upload Content Asset',
    keywords: 'upload asset content library file',
    to: '/content-library',
  },
  {
    id: 'review-queue',
    label: 'Open Review Queue',
    keywords: 'review pending approve lessons queue',
    to: '/courses/reviews',
  },
]

export function buildQuickActionGroup(
  onNavigate: (to: string, search?: Record<string, unknown>) => void,
): CommandPaletteGroup {
  return {
    id: PALETTE_GROUP_IDS.actions,
    heading: 'Quick actions',
    items: QUICK_ACTIONS.map((action) => ({
      id: `action:${action.id}`,
      label: action.label,
      keywords: action.keywords,
      hint: 'Action',
      onSelect: () => onNavigate(action.to, action.search),
    })),
  }
}

/** Sidebar screens, filtered by the caller's role (spec 11 nav matrix). */
export function buildNavigationGroup(
  userRole: string,
  onNavigate: (to: string) => void,
): CommandPaletteGroup {
  const items = NAV_ITEMS.filter((item) => item.roles.includes(userRole))
  return {
    id: PALETTE_GROUP_IDS.navigation,
    heading: 'Go to',
    items: items.map((item: NavItem) => ({
      id: `nav:${item.id}`,
      label: item.label,
      keywords: `${item.to} screen page`,
      hint: 'Screen',
      onSelect: () => onNavigate(item.to),
    })),
  }
}

const RESULT_KIND_LABEL: Record<SearchResultsItem['kind'], string> = {
  course: 'Course',
  lesson: 'Lesson',
  student: 'Student',
  asset: 'Asset',
}

/**
 * Flatten the S-1.3 grouped search payload into one results group. Deep
 * links come from the shared entity-links registry (`result.url`); targets
 * from unimplemented modules are flagged in the hint instead of being
 * hidden, matching the search results page behavior.
 */
export function buildResultsGroup(
  payload: GlobalSearchPayload,
  onNavigate: (url: string) => void,
): CommandPaletteGroup {
  const items = payload.groups.flatMap((group) =>
    group.items.map((result) => ({
      id: `result:${result.kind}:${result.id}`,
      label: result.title,
      keywords: `${result.subtitle ?? ''} ${result.kind}`,
      hint: result.exists
        ? RESULT_KIND_LABEL[result.kind]
        : `${RESULT_KIND_LABEL[result.kind]} (soon)`,
      onSelect: () => onNavigate(result.url),
    })),
  )
  return { id: PALETTE_GROUP_IDS.results, heading: 'Results', items }
}

export const RECENT_SEARCHES_KEY = 'abugida-recent-searches'
export const RECENT_SEARCHES_LIMIT = 5

export function readRecentSearches(storage: Pick<Storage, 'getItem'>): string[] {
  try {
    const raw = storage.getItem(RECENT_SEARCHES_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry): entry is string => typeof entry === 'string')
      .slice(0, RECENT_SEARCHES_LIMIT)
  } catch {
    return []
  }
}

export function rememberSearchTerm(storage: Pick<Storage, 'getItem' | 'setItem'>, term: string) {
  const trimmed = term.trim()
  if (!trimmed) return
  const next = [trimmed, ...readRecentSearches(storage).filter((entry) => entry !== trimmed)]
  storage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next.slice(0, RECENT_SEARCHES_LIMIT)))
}

export function clearRecentSearches(storage: Pick<Storage, 'removeItem'>) {
  storage.removeItem(RECENT_SEARCHES_KEY)
}
