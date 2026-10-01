import type { GlobalSearchPayload, SearchResultsItem } from '#/features/search'
import type { PlatformRole } from '#/features/auth'
import { getVisibleNavItems } from './navigation.config'

/**
 * S-7.5 Command Palette data assembly (spec 09).
 *
 * Pure builders that turn app sources — sidebar navigation, quick actions,
 * and the S-1.3 global-search index — into palette groups. No fetching and
 * no routing happens here; callers supply handlers so the builders stay
 * trivially testable and reusable.
 *
 * Both groups are **role-filtered from the same source as the sidebar**, so the
 * palette can never offer a destination the navigation hides.
 */

export const PALETTE_GROUP_IDS = {
  actions: 'actions',
  navigation: 'navigation',
  results: 'results',
} as const

/** One palette group: a heading and the items that match under it. */
export interface CommandPaletteGroup {
  id: string
  heading: string
  items: Array<{
    id: string
    label: string
    keywords?: string
    hint?: string
    onSelect: () => void
  }>
}

/**
 * Stable match value for the command primitive: a palette item is matched on
 * its label *and* its keywords, so `to` finds "Courses".
 */
export function commandItemValue(item: { label: string; keywords?: string }): string {
  return item.keywords ? `${item.label} ${item.keywords}` : item.label
}

/** Spec S-7.5 quick actions ("Create Course", "Invite Team Member", …). */
export interface QuickAction {
  id: string
  label: string
  keywords?: string
  /** Screen the action opens; empty when the action only navigates. */
  to: string
  search?: Record<string, unknown>
  /** Capability that grants the action — an absent action, never a dead one. */
  roles: readonly PlatformRole[]
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
    roles: ['admin', 'editor'],
  },
  {
    id: 'invite-team-member',
    label: 'Invite Team Member',
    keywords: 'team member invite settings organization',
    to: '/settings/team',
    roles: ['admin'],
  },
  {
    id: 'upload-asset',
    label: 'Upload Content Asset',
    keywords: 'upload asset content library file',
    to: '/content-library',
    roles: ['admin', 'editor', 'reviewer', 'viewer', 'support'],
  },
  {
    id: 'review-queue',
    label: 'Open Review Queue',
    keywords: 'review pending approve lessons queue',
    to: '/courses/reviews',
    roles: ['admin', 'reviewer'],
  },
]

export function buildQuickActionGroup(
  role: PlatformRole,
  onNavigate: (to: string, search?: Record<string, unknown>) => void,
): CommandPaletteGroup {
  return {
    id: PALETTE_GROUP_IDS.actions,
    heading: 'Quick actions',
    items: QUICK_ACTIONS.filter((action) => action.roles.includes(role)).map((action) => ({
      id: `action:${action.id}`,
      label: action.label,
      keywords: action.keywords,
      hint: 'Action',
      onSelect: () => onNavigate(action.to, action.search),
    })),
  }
}

/** Sidebar screens, filtered by the caller's role (spec S-A.1 capability map). */
export function buildNavigationGroup(
  role: PlatformRole,
  onNavigate: (to: string) => void,
): CommandPaletteGroup {
  const items = getVisibleNavItems(role)
  return {
    id: PALETTE_GROUP_IDS.navigation,
    heading: 'Go to',
    items: items.map((item) => ({
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
