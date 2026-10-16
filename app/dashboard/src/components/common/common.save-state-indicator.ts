/**
 * Spec 11 § Auto-save Policy + S-7.8: Save-State Indicator.
 * One shared vocabulary for "is my work saved?" across every editing surface.
 * 8 states: idle/dirty/saving/saved/error/conflict/suspended/offline.
 */

export type SaveState =
  'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict' | 'suspended' | 'offline'

export const SAVE_STATE_LABELS: Record<SaveState, string> = {
  idle: 'All changes saved',
  dirty: 'Unsaved changes · ⌘S',
  saving: 'Saving…',
  saved: 'All changes saved',
  error: 'Save failed — Retry',
  conflict: 'Edited elsewhere — Reload',
  suspended: 'Autosave paused (in review)',
  offline: 'Offline — changes queued',
}

export const SAVING_MIN_DURATION_MS = 300
export const SAVED_DISPLAY_MS = 4000

export type SaveStateVariant = 'full' | 'compact'

export function saveStateLabel(state: SaveState, savedAt?: Date): string {
  if (state === 'saved' && savedAt) {
    const time = savedAt.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    return `All changes saved at ${time}`
  }
  return SAVE_STATE_LABELS[state]
}

export function saveStateAriaLive(
  state: SaveState,
  variant: SaveStateVariant,
): 'polite' | 'assertive' | 'off' {
  if (variant === 'compact') {
    return state === 'error' || state === 'conflict' ? 'assertive' : 'off'
  }
  return 'polite'
}

export function shouldTransitionToIdle(state: SaveState, enteredAt: number, now: number): boolean {
  if (state === 'saved') return now - enteredAt >= SAVED_DISPLAY_MS
  return false
}

export function shouldShowSavingMinDuration(enteredAt: number, now: number): boolean {
  return now - enteredAt < SAVING_MIN_DURATION_MS
}

export function isSaveActionAvailable(state: SaveState): boolean {
  return state === 'dirty' || state === 'error'
}

export function isRetryActionAvailable(state: SaveState): boolean {
  return state === 'error'
}

export function isReloadActionAvailable(state: SaveState): boolean {
  return state === 'conflict'
}

/**
 * Spec 11 § Auto-save: "Content editing autosaves 60s after the last edit;
 * structural changes commit immediately with optimistic UI + rollback."
 */
export const AUTOSAVE_IDLE_MS = 60_000

/**
 * Spec 11 § Auto-save: "The word 'Saved' appears only after the server
 * confirms — never on an optimistic write."
 */
export function shouldShowSaved(serverConfirmed: boolean): boolean {
  return serverConfirmed
}

/**
 * Spec 11: beforeunload guard. A dirty buffer is never discarded silently.
 */
export function shouldGuardBeforeUnload(state: SaveState): boolean {
  return state === 'dirty' || state === 'saving' || state === 'error' || state === 'conflict'
}
