/**
 * Course Workspace contracts (spec 00 § 2.5/§ 2.6, spec 04 "The Course
 * Workspace Model"). Framework-free on purpose: no React, no router, no server
 * imports — this is the shared vocabulary every workspace surface builds
 * against, and it is what the `courses.workspace` bun suite exercises directly.
 *
 * Nothing here reads a database, the environment, or a URL directly. The only
 * URL-adjacent code is the search-param codec below, which takes and returns
 * plain values so the router stays a consumer, not a dependency.
 */

// ── Workspace tabs (S-2.6 shell — exactly five destinations) ────────────────

export const WORKSPACE_TABS = [
  'overview',
  'curriculum',
  'students',
  'analytics',
  'settings',
] as const

export type CourseWorkspaceTab = (typeof WORKSPACE_TABS)[number]

/** `tab` defaults to `overview` (spec 04 § Routing Contract). */
export const DEFAULT_WORKSPACE_TAB: CourseWorkspaceTab = 'overview'

/** The tab that hosts the curriculum tree and the item pane. */
export const CURRICULUM_TAB: CourseWorkspaceTab = 'curriculum'

export const WORKSPACE_TAB_LABELS: Record<CourseWorkspaceTab, string> = {
  overview: 'Overview',
  curriculum: 'Curriculum',
  students: 'Students',
  analytics: 'Analytics',
  settings: 'Settings',
}

export function isCourseWorkspaceTab(value: unknown): value is CourseWorkspaceTab {
  return typeof value === 'string' && (WORKSPACE_TABS as readonly string[]).includes(value)
}

// ── Curriculum item kinds (spec 04 § Curriculum Taxonomy) ───────────────────
//
// Abugida keeps its `modules` + `lessons` storage model; "section" and "item"
// are display labels. An item's kind is derived from `contentType`, so no new
// column is introduced. Kind is fixed at creation.

export const CURRICULUM_ITEM_KINDS = ['lesson', 'quiz', 'assignment'] as const

export type CurriculumItemKind = (typeof CURRICULUM_ITEM_KINDS)[number]

/** `lessons.contentType` values that resolve to each kind (spec 04). */
export const CURRICULUM_ITEM_CONTENT_TYPES: Record<CurriculumItemKind, readonly string[]> = {
  lesson: ['video', 'pdf', 'link'],
  quiz: ['quiz'],
  assignment: ['exercise'],
}

export const CURRICULUM_ITEM_KIND_LABELS: Record<CurriculumItemKind, string> = {
  lesson: 'Lesson',
  quiz: 'Quiz',
  assignment: 'Assignment',
}

/** The screen that authors each kind — used for "Authored in" affordances. */
export const CURRICULUM_ITEM_KIND_SCREENS: Record<CurriculumItemKind, string> = {
  lesson: 'S-2.7',
  quiz: 'S-2.8',
  assignment: 'S-2.23',
}

export function isCurriculumItemKind(value: unknown): value is CurriculumItemKind {
  return typeof value === 'string' && (CURRICULUM_ITEM_KINDS as readonly string[]).includes(value)
}

/**
 * Derive an item's kind from its `contentType`. Returns `null` for a value no
 * kind claims, so an unknown content type surfaces as a data problem rather
 * than silently rendering as a Lesson.
 */
export function deriveCurriculumItemKind(contentType: unknown): CurriculumItemKind | null {
  if (typeof contentType !== 'string') return null
  const normalized = contentType.trim().toLowerCase()
  for (const kind of CURRICULUM_ITEM_KINDS) {
    if (CURRICULUM_ITEM_CONTENT_TYPES[kind].includes(normalized)) return kind
  }
  return null
}

// ── Save-state vocabulary (S-7.8 — one vocabulary, every surface) ───────────
//
// The six states below are the shared save contract. No surface may invent its
// own "Saving…" string; the indicator renders these and the owning surface
// drives them.

export const SAVE_STATES = ['idle', 'dirty', 'saving', 'saved', 'error', 'conflict'] as const

export type SaveState = (typeof SAVE_STATES)[number]

/**
 * Two situational states S-7.8 adds on top of the six: the review lock and the
 * offline queue. They are extensions, not members of the save contract, so
 * `SaveState` stays exactly the six every editing surface implements.
 */
export const SAVE_STATE_EXTENSIONS = ['suspended', 'offline'] as const

export type SaveStateExtension = (typeof SAVE_STATE_EXTENSIONS)[number]

/** Any state the indicator can display. */
export type AnySaveState = SaveState | SaveStateExtension

export const SAVE_STATE_LABELS: Record<SaveState, string> = {
  idle: 'All changes saved',
  dirty: 'Unsaved changes · ⌘S',
  saving: 'Saving…',
  saved: 'All changes saved at HH:MM',
  error: 'Save failed — Retry',
  conflict: 'Edited elsewhere — Reload',
}

export const SAVE_STATE_EXTENSION_LABELS: Record<SaveStateExtension, string> = {
  suspended: 'Autosave paused (in review)',
  offline: 'Offline — changes queued',
}

export function isSaveState(value: unknown): value is SaveState {
  return typeof value === 'string' && (SAVE_STATES as readonly string[]).includes(value)
}

/**
 * A state in which the buffer must be flushed before the context may change —
 * switching item, tab, section, or route (S-7.8 behaviour rule 3). `error` and
 * `conflict` count: the buffer is still unresolved, so navigation is blocked
 * with Retry / Discard / Stay rather than discarding silently.
 */
export function saveStateBlocksNavigation(state: AnySaveState): boolean {
  return state === 'dirty' || state === 'saving' || state === 'error' || state === 'conflict'
}

/** A state whose failure the indicator must keep visible until resolved. */
export function isUnresolvedSaveState(state: AnySaveState): boolean {
  return state === 'error' || state === 'conflict'
}

// ── Course lifecycle (spec 04 § Course Lifecycle) ──────────────────────────

export const COURSE_LIFECYCLE_STATES = ['draft', 'in_review', 'published', 'archived'] as const

export type CourseLifecycleState = (typeof COURSE_LIFECYCLE_STATES)[number]

/** Display order for the lifecycle stepper in the identity header. */
export const COURSE_LIFECYCLE_ORDER: readonly CourseLifecycleState[] = COURSE_LIFECYCLE_STATES

export const COURSE_LIFECYCLE_LABELS: Record<CourseLifecycleState, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  published: 'Published',
  archived: 'Archived',
}

/**
 * Allowed edges of the lifecycle state machine (spec 04). Values are the
 * states reachable in one guarded action; `withdrawn` and `changes requested`
 * both return an In Review course to Draft.
 */
export const COURSE_LIFECYCLE_TRANSITIONS: Record<
  CourseLifecycleState,
  readonly CourseLifecycleState[]
> = {
  draft: ['in_review', 'published'],
  in_review: ['draft', 'published'],
  published: ['draft', 'archived'],
  archived: ['draft'],
}

export function isCourseLifecycleState(value: unknown): value is CourseLifecycleState {
  return typeof value === 'string' && (COURSE_LIFECYCLE_STATES as readonly string[]).includes(value)
}

export function canTransitionCourseLifecycle(
  from: CourseLifecycleState,
  to: CourseLifecycleState,
): boolean {
  return COURSE_LIFECYCLE_TRANSITIONS[from].includes(to)
}

/** Only a Published course is visible to students. */
export function isCourseVisibleToStudents(state: CourseLifecycleState): boolean {
  return state === 'published'
}

// ── Workspace search params (spec 00 § 2.6 route shape) ────────────────────
//
// `/_app/courses/$courseId?tab=overview|curriculum|students|analytics|settings`
// with `?item=<publicId>`. `item` is a **publicId**, never a numeric id, and
// is ignored outside the Curriculum tab.

/** Parsed, validated workspace search params. */
export interface CourseWorkspaceSearchParams {
  tab: CourseWorkspaceTab
  item?: string
}

/** Anything a router search-parser may hand us; every field is untrusted. */
export interface RawCourseWorkspaceSearch {
  tab?: unknown
  item?: unknown
}

export type CourseWorkspaceSearchInput =
  string | URLSearchParams | RawCourseWorkspaceSearch | null | undefined

/**
 * Normalise an item publicId: trim, and drop empty/oversized values. A publicId
 * is a slug, so anything containing whitespace or a slash is not one.
 */
export function normalizeItemPublicId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > 128) return undefined
  if (/\s/.test(trimmed) || trimmed.includes('/')) return undefined
  return trimmed
}

function toRawSearch(input: CourseWorkspaceSearchInput): RawCourseWorkspaceSearch {
  if (input === null || input === undefined) return {}
  if (typeof input === 'string') {
    const query = input.startsWith('?') ? input.slice(1) : input
    if (query.length === 0) return {}
    return Object.fromEntries(new URLSearchParams(query).entries())
  }
  if (input instanceof URLSearchParams) return Object.fromEntries(input.entries())
  return input
}

/**
 * Parse workspace search params with a safe default. A missing or unrecognised
 * `tab` falls back to `overview`; a missing, malformed, or out-of-tab `item`
 * is dropped rather than opening a pane that cannot be rendered.
 */
export function parseCourseWorkspaceSearch(
  input: CourseWorkspaceSearchInput,
): CourseWorkspaceSearchParams {
  const raw = toRawSearch(input)
  const tab = isCourseWorkspaceTab(raw.tab) ? raw.tab : DEFAULT_WORKSPACE_TAB
  const item = tab === CURRICULUM_TAB ? normalizeItemPublicId(raw.item) : undefined
  return item === undefined ? { tab } : { tab, item }
}

/**
 * Serialise workspace search params for `navigate({ search })`. The active tab
 * is always mirrored in the URL so any tab is linkable, bookmarkable, and
 * back-button safe; `item` is emitted only on the Curriculum tab.
 *
 * Returns a leading-`?` search string, or `''` when there is nothing to write
 * (so callers can concatenate it onto a path unconditionally).
 */
export function serializeCourseWorkspaceSearch(params: CourseWorkspaceSearchParams): string {
  const search = new URLSearchParams()
  search.set('tab', params.tab)
  if (params.tab === CURRICULUM_TAB) {
    const item = normalizeItemPublicId(params.item)
    if (item !== undefined) search.set('item', item)
  }
  return `?${search.toString()}`
}

/** Build the workspace href for a course. `path` is the caller's route path. */
export function buildCourseWorkspaceHref(
  path: string,
  params: CourseWorkspaceSearchParams,
): string {
  const base = path.replace(/\/+$/, '')
  return `${base}${serializeCourseWorkspaceSearch(params)}`
}

/**
 * The legacy standalone lesson route is an **alias** for the workspace
 * Curriculum tab with that item selected (spec 04 § Routing Contract). One
 * editor, two hosts — the alias must never host a second implementation.
 */
export function buildLessonAliasHref(coursePath: string, itemPublicId: string): string {
  return buildCourseWorkspaceHref(coursePath, { tab: CURRICULUM_TAB, item: itemPublicId })
}
