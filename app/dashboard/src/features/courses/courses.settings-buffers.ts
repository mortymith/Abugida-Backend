/**
 * Course Settings per-section dirty-buffer logic (spec 04 § S-2.20 →
 * Course Workspace — Settings, § Save Semantics).
 *
 * The Settings tab has seven independent sections (Details, Pricing &
 * enrollment, Curriculum defaults, Live sessions, Completion &
 * certificates, Review & approval, Danger zone). Each section has its
 * own dirty buffer and its own `Flush now` button — a dirty buffer in
 * one section does not block switching to another section, but each
 * section's switch flushes its own buffer first.
 *
 * This module owns:
 *
 * 1. **The seven section identifiers** and their display labels.
 * 2. **Per-section dirty-buffer state** — which sections are dirty,
 *    which are saving, which are clean.
 * 3. **Switch-section semantics** — when the user switches sections, the
 *    current section's dirty buffer flushes first; on failure, an S-7.1
 *    dialog offers Retry / Discard / Stay (Discard never default).
 * 4. **Archived-course replacement** — when the course is archived, the
 *    whole Settings tab is replaced by an explanation banner (case 3 of
 *    the permission rule).
 *
 * This module is framework-free: it owns the section model and the
 * dirty-buffer state machine.
 */

export const SETTINGS_SECTIONS = [
  'details',
  'pricing_enrollment',
  'curriculum_defaults',
  'live_sessions',
  'completion_certificates',
  'review_approval',
  'danger_zone',
] as const

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

export const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  details: 'Details',
  pricing_enrollment: 'Pricing & enrollment',
  curriculum_defaults: 'Curriculum defaults',
  live_sessions: 'Live sessions',
  completion_certificates: 'Completion & certificates',
  review_approval: 'Review & approval',
  danger_zone: 'Danger zone',
}

export type SectionSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export interface SectionBufferState {
  readonly section: SettingsSection
  readonly saveState: SectionSaveState
  readonly lastSavedAt: number | null
  readonly error: string | null
}

export type SectionBufferMap = Readonly<Record<SettingsSection, SectionBufferState>>

/**
 * Create a clean buffer map (every section idle) for a freshly loaded
 * course.
 */
export function createCleanBufferMap(): SectionBufferMap {
  const map = {} as Record<SettingsSection, SectionBufferState>
  for (const section of SETTINGS_SECTIONS) {
    map[section] = {
      section,
      saveState: 'idle',
      lastSavedAt: null,
      error: null,
    }
  }
  return map
}

/**
 * Whether any section has a dirty or in-flight buffer. Used by the
 * `beforeunload` guard — the guard is active if ANY section is dirty or
 * saving.
 */
export function hasUnsavedChanges(buffers: SectionBufferMap): boolean {
  return SETTINGS_SECTIONS.some((section) => {
    const state = buffers[section].saveState
    return state === 'dirty' || state === 'saving' || state === 'error'
  })
}

/**
 * Whether a section switch is permitted. The spec mandates: switching
 * sections flushes the current section's dirty buffer first. If the
 * flush fails, an S-7.1 dialog offers Retry / Discard / Stay.
 *
 * This function returns the action the caller should take:
 * - `proceed` — the current section is clean (or just flushed); switch.
 * - `flush_first` — the current section is dirty; flush it, then switch.
 * - `confirm_discard` — the flush failed; ask the user (Retry / Discard
 *   / Stay, Discard never default).
 */
export type SwitchSectionAction =
  | { readonly kind: 'proceed' }
  | { readonly kind: 'flush_first'; readonly fromSection: SettingsSection }
  | {
      readonly kind: 'confirm_discard'
      readonly fromSection: SettingsSection
      readonly error: string
    }

export function resolveSwitchAction(
  buffers: SectionBufferMap,
  fromSection: SettingsSection,
): SwitchSectionAction {
  const state = buffers[fromSection]
  if (state.saveState === 'dirty') {
    return { kind: 'flush_first', fromSection }
  }
  if (state.saveState === 'error') {
    return { kind: 'confirm_discard', fromSection, error: state.error ?? 'Save failed' }
  }
  return { kind: 'proceed' }
}

/**
 * Whether the Settings tab should be replaced by an archived-course
 * banner (case 3 of the permission rule). When the course is archived,
 * the whole tab is read-only — the user cannot edit any section.
 */
export function shouldReplaceWithArchivedBanner(courseStatus: string): boolean {
  return courseStatus === 'archived'
}

/**
 * The label for the `Flush now` button in a section. Disabled with
 * `aria-describedby="No unsaved changes"` when the buffer is clean
 * (idle/saved/saving).
 */
export function sectionFlushLabel(state: SectionSaveState): {
  label: string
  disabled: boolean
  ariaDescribedBy: string
} {
  if (state === 'idle' || state === 'saved' || state === 'saving') {
    return {
      label: 'Flush now',
      disabled: true,
      ariaDescribedBy: 'No unsaved changes',
    }
  }
  if (state === 'error') {
    return {
      label: 'Retry save',
      disabled: false,
      ariaDescribedBy: 'Save failed — click to retry',
    }
  }
  return {
    label: 'Flush now',
    disabled: false,
    ariaDescribedBy: '',
  }
}

/**
 * Count of sections with unsaved changes. Used by the tab badge
 * ("Settings (2)" when 2 sections are dirty).
 */
export function dirtySectionCount(buffers: SectionBufferMap): number {
  return SETTINGS_SECTIONS.filter((s) => buffers[s].saveState === 'dirty').length
}
