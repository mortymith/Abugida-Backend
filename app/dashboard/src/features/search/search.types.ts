import type { LinkableEntityType } from '#/lib/entity-links'

export type SearchGroupType = Extract<LinkableEntityType, 'course' | 'lesson' | 'student' | 'asset'>

export const SEARCH_GROUP_TYPES: readonly SearchGroupType[] = [
  'course',
  'lesson',
  'asset',
  'student',
]

/**
 * Plural display label per group. Owned here (not in the server response)
 * because both the command palette and the results page render headings from
 * the same kind, including for groups that came back empty.
 */
export const SEARCH_GROUP_LABELS: Record<SearchGroupType, string> = {
  course: 'Courses',
  lesson: 'Lessons',
  asset: 'Assets',
  student: 'Students',
}

/**
 * Per-group cap applied by the server query. The UI uses it to say "showing
 * the first N" instead of presenting a truncated list as exhaustive.
 */
export const SEARCH_RESULT_LIMIT = 20

export interface SearchResultsItem {
  kind: SearchGroupType
  /** Stable public identifier used to build the deep link. */
  id: string
  title: string
  subtitle?: string
  url: string
  /** False while the target route belongs to an unimplemented spec module. */
  exists: boolean
}

export interface SearchGroup {
  kind: SearchGroupType
  label: string
  /** Total matches for the group (drives the tab counts). */
  total: number
  items: SearchResultsItem[]
}

export interface GlobalSearchPayload {
  query: string
  groups: SearchGroup[]
  totalMatches: number
  /** Groups hidden from this caller (e.g. students for viewer role). */
  omittedGroups: { kind: SearchGroupType; reason: string }[]
}
