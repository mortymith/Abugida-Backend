/**
 * Settings save-state + flush-on-switch logic (spec 08 § Settings IA).
 *
 * The spec: "Each section writes its own rowVersion and has its own
 * sticky section footer. Switching sections flushes the dirty buffer
 * first. If the flush fails, navigation is blocked with Retry / Discard
 * / Stay. A dirty buffer is never discarded silently."
 */

export const SETTINGS_SECTIONS = [
  'general',
  'team',
  'roles',
  'integrations',
  'branding',
  'billing',
  'api',
  'security',
  'privacy',
  'danger',
] as const

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

export const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  general: 'General',
  team: 'Team',
  roles: 'Roles',
  integrations: 'Integrations',
  branding: 'Branding',
  billing: 'Billing',
  api: 'API & Webhooks',
  security: 'Security',
  privacy: 'Privacy',
  danger: 'Danger Zone',
}

export type SectionSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export interface SectionBufferState {
  readonly section: SettingsSection
  readonly saveState: SectionSaveState
  readonly lastSavedAt: number | null
  readonly error: string | null
}

export type SectionBufferMap = Readonly<Record<SettingsSection, SectionBufferState>>

export function createCleanBufferMap(): SectionBufferMap {
  const map = {} as Record<SettingsSection, SectionBufferState>
  for (const section of SETTINGS_SECTIONS) {
    map[section] = { section, saveState: 'idle', lastSavedAt: null, error: null }
  }
  return map
}

/**
 * Whether any section has a dirty or in-flight buffer. Used by the
 * `beforeunload` guard.
 */
export function hasUnsavedChanges(buffers: SectionBufferMap): boolean {
  return SETTINGS_SECTIONS.some((s) => {
    const state = buffers[s].saveState
    return state === 'dirty' || state === 'saving' || state === 'error'
  })
}

/**
 * The switch-section action. The spec: "Switching sections flushes the
 * dirty buffer first. If the flush fails, navigation is blocked with
 * Retry / Discard / Stay."
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
  if (state.saveState === 'dirty') return { kind: 'flush_first', fromSection }
  if (state.saveState === 'error')
    return { kind: 'confirm_discard', fromSection, error: state.error ?? 'Save failed' }
  return { kind: 'proceed' }
}

/**
 * The section-footer label. "All changes saved" / "Unsaved changes · ⌘S"
 * / "Saving…" / "Save failed — Retry".
 */
export function footerLabel(state: SectionSaveState): string {
  switch (state) {
    case 'idle':
      return 'All changes saved'
    case 'dirty':
      return 'Unsaved changes · ⌘S'
    case 'saving':
      return 'Saving…'
    case 'saved':
      return 'All changes saved'
    case 'error':
      return 'Save failed — Retry'
  }
}

/**
 * Whether the "Save changes" button is disabled. Disabled when clean
 * (idle/saved/saving). Enabled when dirty or error.
 */
export function isSaveButtonDisabled(state: SectionSaveState): boolean {
  return state === 'idle' || state === 'saved' || state === 'saving'
}

/**
 * Whether the "Discard changes" button is active. Active when dirty or error.
 */
export function isDiscardButtonActive(state: SectionSaveState): boolean {
  return state === 'dirty' || state === 'error'
}

/**
 * Count of sections with unsaved changes, for a tab badge.
 */
export function dirtySectionCount(buffers: SectionBufferMap): number {
  return SETTINGS_SECTIONS.filter((s) => buffers[s].saveState === 'dirty').length
}
