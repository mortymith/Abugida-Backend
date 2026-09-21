import type { LinkableEntityType } from '#/lib/entity-links'

export type SearchGroupType = Extract<LinkableEntityType, 'course' | 'lesson' | 'student' | 'asset'>

export const SEARCH_GROUP_TYPES: readonly SearchGroupType[] = [
  'course',
  'lesson',
  'asset',
  'student',
]

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
