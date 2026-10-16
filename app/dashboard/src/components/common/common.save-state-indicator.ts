/**
 * S-7.8 Save-State Indicator (spec 09 § S-7.8).
 * One shared vocabulary for "is my work saved?" across every editing surface.
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

export const SAVE_STATE_DURATIONS_MS: Partial<Record<SaveState, number>> = {
  saved: 4000, // 4s, then idle
}

export const SAVING_MIN_DURATION_MS = 300 // floor so it does not flicker

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
    if (state === 'error' || state === 'conflict') return 'assertive'
    return 'off'
  }
  // full variant
  return 'polite'
}

export function shouldTransitionToIdle(state: SaveState, enteredAt: number, now: number): boolean {
  if (state === 'saved') {
    const duration = SAVE_STATE_DURATIONS_MS.saved ?? 4000
    return now - enteredAt >= duration
  }
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

export function shouldNeverShowBothVariants(
  fullMounted: boolean,
  compactMounted: boolean,
): boolean {
  // The two variants are never shown simultaneously for the same buffer.
  return !(fullMounted && compactMounted)
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
 * Spec 11 § Resilience: the `beforeunload` guard. A dirty buffer is never
 * discarded silently, and a flush still in flight must not be lost.
 */
export function shouldGuardBeforeUnload(state: SaveState): boolean {
  return state === 'dirty' || state === 'saving' || state === 'error' || state === 'conflict'
}
