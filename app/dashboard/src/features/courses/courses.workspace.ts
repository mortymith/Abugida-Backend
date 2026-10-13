/**
 * Course Workspace contracts (spec 00 § 2.5/§ 2.6, spec 04 "The Course
 * Workspace Model"). Framework-free on purpose: no React, no router, no server
 * imports — this is the shared vocabulary every workspace surface builds
 * against, and it is what the `courses.workspace` bun suite exercises directly.
 *
 * Nothing here reads a database, the environment, or a URL directly. The only
 * URL-adjacent code is the search-param codec below, which takes and returns
 * plain values so the router stays a consumer, not a dependency.
 *
 * Revision 3 additions live here too — the fifth lifecycle state, per-item
 * visibility, the analytics sub-tabs, and role-filtered tab access — because the
 * spec makes this module the single source of truth for all of them. A screen
 * that invents its own copy of any of these is the drift the spec warns about.
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

/** Tabs that carry a count badge in the workspace nav (S-2.6 wireframe). */
export const COUNTED_WORKSPACE_TABS: readonly CourseWorkspaceTab[] = ['curriculum', 'students']

// ── Role access to the workspace nav (spec 04 § Routing Contract) ────────────
//
// The workspace route itself admits admin/editor/reviewer/viewer/support — the
// destinations differ, not the route. Support is the special case: their nav
// renders the **Students tab only**, and the other four are *absent entirely*
// (case 1 of the three-case permission rule), so they can never produce a 403.

/** Roles that reach the workspace at all. */
export const WORKSPACE_ROLES = ['admin', 'editor', 'reviewer', 'viewer', 'support'] as const

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number]

/** Support sees the roster and nothing else. */
export const SUPPORT_WORKSPACE_TABS: readonly CourseWorkspaceTab[] = ['students']

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return typeof value === 'string' && (WORKSPACE_ROLES as readonly string[]).includes(value)
}

/**
 * The tabs a role may navigate to, in display order. An unknown role is given
 * the read-only set rather than the authoring set: a capability the platform
 * does not recognise must never grant authoring surfaces.
 */
export function workspaceTabsForRole(role: unknown): readonly CourseWorkspaceTab[] {
  if (role === 'support') return SUPPORT_WORKSPACE_TABS
  if (isWorkspaceRole(role)) return WORKSPACE_TABS
  return SUPPORT_WORKSPACE_TABS
}

/** Whether `tab` is reachable by `role` at all (absent, not disabled). */
export function canAccessWorkspaceTab(role: unknown, tab: CourseWorkspaceTab): boolean {
  return workspaceTabsForRole(role).includes(tab)
}

/**
 * Keep a requested tab on the boundary of what the role may open.
 *
 * Support deep-linking `?tab=analytics` lands on Students — their only
 * destination — rather than on `overview`, which their nav does not even show
 * and would render an empty shell.
 */
export function resolveWorkspaceTab(role: unknown, requested: unknown): CourseWorkspaceTab {
  const allowed = workspaceTabsForRole(role)
  const tab = isCourseWorkspaceTab(requested) ? requested : DEFAULT_WORKSPACE_TAB
  if (allowed.includes(tab)) return tab
  // Every tab set starts with the tab that role should land on.
  return allowed[0] ?? DEFAULT_WORKSPACE_TAB
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

// ── Item visibility (spec 04 Revision 3, § Item visibility) ──────────────────
//
// Per-item and independent of the course lifecycle. This is what lets a live
// course grow one item at a time without publishing the whole draft.

export const ITEM_VISIBILITIES = ['draft', 'published', 'scheduled'] as const

export type ItemVisibility = (typeof ITEM_VISIBILITIES)[number]

export function isItemVisibility(value: unknown): value is ItemVisibility {
  return typeof value === 'string' && (ITEM_VISIBILITIES as readonly string[]).includes(value)
}

/** Human label for the row/pane pill. `draft` is the one that needs naming. */
export const ITEM_VISIBILITY_LABELS: Record<ItemVisibility, string> = {
  draft: 'Unpublished',
  published: 'Published',
  scheduled: 'Scheduled',
}

/**
 * Only `draft` renders a pill; published items are the unmarked happy
 * path. `scheduledFor` may arrive as an ISO string (the DTO shape) or
 * a `Date` (a caller that already parsed it); both render the same pill.
 */
export function itemVisibilityPillLabel(
  visibility: ItemVisibility,
  scheduledFor?: string | Date | null,
): string | null {
  if (visibility === 'draft') return ITEM_VISIBILITY_LABELS.draft
  if (visibility === 'scheduled') {
    return scheduledFor
      ? `${ITEM_VISIBILITY_LABELS.scheduled} ${formatVisibilityDate(scheduledFor)}`
      : ITEM_VISIBILITY_LABELS.scheduled
  }
  return null
}

/**
 * The **published set** (spec 04): items of the course where `visibility =
 * 'published'` and `archived_at IS NULL` and `deleted_at IS NULL`.
 *
 * It is a subset of the curriculum, not a synonym for it. Every readiness check
 * and the completion rule read this predicate, which is why they cannot
 * disagree about what a course ships.
 */
export function isInPublishedSet(item: {
  visibility?: unknown
  archivedAt?: string | null
  deletedAt?: string | null
}): boolean {
  if (!isItemVisibility(item.visibility)) return false
  if (item.visibility !== 'published') return false
  return !item.archivedAt && !item.deletedAt
}

/**
 * A `scheduled` item is not in the published set *yet*. Once its moment passes
 * it counts — so the predicate is time-aware rather than a second hardcoded
 * rule the readiness checks could drift from.
 */
export function isInPublishedSetAt(
  item: {
    visibility?: unknown
    scheduledPublishAt?: string | null
    archivedAt?: string | null
    deletedAt?: string | null
  },
  now: Date,
): boolean {
  if (item.archivedAt || item.deletedAt) return false
  if (!isItemVisibility(item.visibility)) return false
  if (item.visibility === 'published') return true
  if (item.visibility === 'scheduled') {
    if (!item.scheduledPublishAt) return false
    const at = new Date(item.scheduledPublishAt)
    return Number.isFinite(at.getTime()) ? at.getTime() <= now.getTime() : false
  }
  return false
}

/**
 * Locale-stable short date for a scheduled pill. `en-GB` abbreviates September
 * as "Sept" while every other month is three letters, so the month names are
 * listed rather than derived — a pill whose date is a different width on one
 * month out of twelve is a layout wobble, not a localisation win.
 */
const MONTH_SHORT_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

function formatVisibilityDate(value: string | Date): string {
  const at = new Date(value)
  if (!Number.isFinite(at.getTime())) return ''
  // UTC is deliberate: the pill is a date, and a viewer in another timezone must
  // read the same one the server scheduled. Full timestamps stay EAT-resolved.
  const day = at.getUTCDate()
  const month = MONTH_SHORT_NAMES[at.getUTCMonth()] ?? ''
  return `${day} ${month}`
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
  conflict: 'Edited elsewhere — resolve',
}

export const SAVE_STATE_EXTENSION_LABELS: Record<SaveStateExtension, string> = {
  suspended: 'Autosave paused (in review)',
  offline: 'Offline — changes queued',
}

export function isSaveState(value: unknown): value is SaveState {
  return typeof value === 'string' && (SAVE_STATES as readonly string[]).includes(value)
}

/**
 * The explicit flush control's label (spec 04 § Save Semantics).
 *
 * The 60s idle timer and this button are not two competing save systems: the
 * button exists only to force a flush early. Naming it "Save" would imply the
 * buffer is at risk; `Flush now` says autosave is already running.
 */
export const FLUSH_NOW_LABEL = 'Flush now'
export const FLUSH_NOW_SHORTCUT = '⌘S'

/**
 * `aria-describedby` text for the flush control when the buffer is clean. The
 * button stays rendered and disabled — the reason must be announced, not the
 * control silently vanishing (S-7.8 / WCAG).
 */
export const NO_UNSAVED_CHANGES_REASON = 'No unsaved changes'

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

// ── Course lifecycle (spec 04 Revision 3, § Course Lifecycle) ───────────────
//
// Five states: `Draft → In Review → Approved → Published → Archived`.
//
// `Approved` is *derived*, not a `courses.status` value. The column is
// `draft` throughout (which is exactly what the catalog's Approved filter
// matches); `approved_at` is what marks the course as sitting between review
// and publication. Keeping it a timestamp rather than a status value is what
// lets `RC-*` and the state diagram agree with the storage model.

export const COURSE_LIFECYCLE_STATES = [
  'draft',
  'in_review',
  'approved',
  'published',
  'archived',
] as const

export type CourseLifecycleState = (typeof COURSE_LIFECYCLE_STATES)[number]

/** Display order for the lifecycle stepper in the identity header. */
export const COURSE_LIFECYCLE_ORDER: readonly CourseLifecycleState[] = COURSE_LIFECYCLE_STATES

export const COURSE_LIFECYCLE_LABELS: Record<CourseLifecycleState, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  approved: 'Approved',
  published: 'Published',
  archived: 'Archived',
}

/**
 * Allowed edges of the lifecycle state machine (spec 04). `withdrawn` and
 * `changes requested` both return an In Review course to Draft; any edit clears
 * `approved_at`, which is how Approved falls back to Draft.
 */
export const COURSE_LIFECYCLE_TRANSITIONS: Record<
  CourseLifecycleState,
  readonly CourseLifecycleState[]
> = {
  draft: ['in_review', 'published'],
  in_review: ['draft', 'approved', 'published'],
  approved: ['draft', 'published'],
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

/** The stored `courses.status` (four values) and `approved_at` (a timestamp). */
export interface CourseLifecycleSnapshot {
  status: unknown
  approvedAt?: string | Date | null
}

/**
 * Collapse the stored row into the five-state lifecycle.
 *
 * `approved_at` only means Approved while the course is still a Draft. Once it
 * publishes, `published_at`/`status` takes over; and a stale `approved_at` left
 * behind by a withdrawal must not resurrect the state, so the caller clears it
 * (spec 04: cleared on withdrawal, on any subsequent edit, and on unpublish).
 */
export function deriveCourseLifecycleState(
  snapshot: CourseLifecycleSnapshot,
): CourseLifecycleState {
  const status = snapshot.status
  if (status === 'published' || status === 'archived' || status === 'in_review') {
    return status
  }
  if (status === 'draft') {
    return snapshot.approvedAt ? 'approved' : 'draft'
  }
  return 'draft'
}

/**
 * The lifecycle action the identity header offers, or `null` when the course is
 * in a state with no single next step (Archived is reachable from Published via
 * the `⋯` menu rather than as the primary CTA).
 */
export type CourseLifecycleAction = 'submit' | 'withdraw' | 'publish' | 'unpublish' | 'restore'

export interface CourseLifecycleCta {
  action: CourseLifecycleAction
  label: string
}

export function courseLifecycleCta(
  state: CourseLifecycleState,
  requiresApproval: boolean,
): CourseLifecycleCta | null {
  switch (state) {
    case 'draft':
      // An Editor on a gated course cannot self-approve, so they submit; an
      // ungated course publishes straight from Draft.
      return requiresApproval
        ? { action: 'submit', label: 'Submit for review' }
        : { action: 'publish', label: 'Publish' }
    case 'in_review':
      return { action: 'withdraw', label: 'Withdraw' }
    case 'approved':
      return { action: 'publish', label: 'Publish' }
    case 'published':
      return { action: 'unpublish', label: 'Unpublish' }
    case 'archived':
      return { action: 'restore', label: 'Restore' }
  }
}

// ── Analytics sub-tabs (S-2.19, mirrored in `?atab=`) ───────────────────────

export const ANALYTICS_TABS = ['performance', 'dropoff', 'quizzes', 'items'] as const

export type CourseAnalyticsTab = (typeof ANALYTICS_TABS)[number]

export const DEFAULT_ANALYTICS_TAB: CourseAnalyticsTab = 'performance'

export const ANALYTICS_TAB_LABELS: Record<CourseAnalyticsTab, string> = {
  performance: 'Performance',
  dropoff: 'Drop-off',
  quizzes: 'Quizzes',
  items: 'Items',
}

export function isCourseAnalyticsTab(value: unknown): value is CourseAnalyticsTab {
  return typeof value === 'string' && (ANALYTICS_TABS as readonly string[]).includes(value)
}

/** An unknown `atab` falls back to `performance` rather than an empty tab. */
export function resolveAnalyticsTab(value: unknown): CourseAnalyticsTab {
  return isCourseAnalyticsTab(value) ? value : DEFAULT_ANALYTICS_TAB
}

// ── Workspace search params (spec 00 § 2.6 route shape) ────────────────────
//
// `/_app/courses/$courseId?tab=overview|curriculum|students|analytics|settings`
// with `?item=<publicId>` and, on the analytics tab, `?atab=`. `item` is a
// **publicId**, never a numeric id. Both `item` and `atab` are ignored outside
// the tab they belong to.

/** Parsed, validated workspace search params. */
export interface CourseWorkspaceSearchParams {
  tab: CourseWorkspaceTab
  item?: string
  atab?: CourseAnalyticsTab
}

/** Anything a router search-parser may hand us; every field is untrusted. */
export interface RawCourseWorkspaceSearch {
  tab?: unknown
  item?: unknown
  atab?: unknown
}

/**
 * The same params with every field optional — what a router `validateSearch`
 * must return so that a link omitting `search` still typechecks.
 *
 * This is the *route* shape; `parseCourseWorkspaceSearch` is the *resolved*
 * shape (default applied, out-of-tab params dropped). Keeping them separate is
 * what stops the route from having to know the caller's role: a required `tab`
 * here would force every `<Link to="/courses/$courseId">` in the app to name a
 * tab it does not care about.
 */
export interface CourseWorkspaceSearch {
  tab?: CourseWorkspaceTab
  item?: string
  atab?: CourseAnalyticsTab
}

/**
 * Validate raw search params for the workspace route, preserving optionality.
 *
 * Shares `isCourseWorkspaceTab` / `normalizeItemPublicId` / `resolveAnalyticsTab`
 * with `parseCourseWorkspaceSearch` so the two cannot drift on what a legal
 * value is — only on whether a default is applied.
 */
export function validateCourseWorkspaceSearch(
  input: RawCourseWorkspaceSearch,
): CourseWorkspaceSearch {
  const search: CourseWorkspaceSearch = {}
  if (isCourseWorkspaceTab(input.tab)) search.tab = input.tab
  if (input.tab === CURRICULUM_TAB || input.tab === undefined) {
    const item = normalizeItemPublicId(input.item)
    if (item !== undefined) search.item = item
  }
  if (input.tab === 'analytics') search.atab = resolveAnalyticsTab(input.atab)
  return search
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
 * `tab` falls back to `overview`; a missing, malformed, or out-of-tab `item` or
 * `atab` is dropped rather than opening a pane that cannot be rendered.
 */
export function parseCourseWorkspaceSearch(
  input: CourseWorkspaceSearchInput,
): CourseWorkspaceSearchParams {
  const raw = toRawSearch(input)
  const tab = isCourseWorkspaceTab(raw.tab) ? raw.tab : DEFAULT_WORKSPACE_TAB
  const params: CourseWorkspaceSearchParams = { tab }
  if (tab === CURRICULUM_TAB) {
    const item = normalizeItemPublicId(raw.item)
    if (item !== undefined) params.item = item
  }
  if (tab === 'analytics') params.atab = resolveAnalyticsTab(raw.atab)
  return params
}

/**
 * Serialise workspace search params for `navigate({ search })`. The active tab
 * is always mirrored in the URL so any tab is linkable, bookmarkable, and
 * back-button safe; `item` is emitted only on the Curriculum tab and `atab`
 * only on the Analytics tab.
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
  if (params.tab === 'analytics') {
    search.set('atab', params.atab ?? DEFAULT_ANALYTICS_TAB)
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
