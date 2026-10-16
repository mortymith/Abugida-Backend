/**
 * Save-State contract (spec 04 § Save Semantics, spec 11 § Save-State Contract,
 * spec 09 S-7.8 Save-State Indicator).
 *
 * Framework-free on purpose: this is the vocabulary every editing surface —
 * the lesson editor, the quiz builder, the assignment builder, every Settings
 * section — reports through. The React component (`SaveStateIndicator`) and
 * the autosave hook (`useLessonAutosave`) are consumers, not owners.
 *
 * The contract has two invariants the spec is explicit about:
 *
 * 1. **"Saved" never appears before the server confirms.** A flush that has
 *    not yet resolved is `saving`, never `saved`. A flush that errored leaves
 *    the buffer intact and the state in `error` — the author's work is never
 *    discarded silently.
 *
 * 2. **`Flush now` is disabled with `aria-describedby="No unsaved changes"`
 *    when the buffer is clean.** The button is never hidden, never a silent
 *    no-op, and never labelled "Save" (autosave is already running; the
 *    button *flushes* the buffer on demand).
 */

export const SAVE_STATES = ['idle', 'dirty', 'saving', 'saved', 'error', 'conflict'] as const

export type SaveState = (typeof SAVE_STATES)[number]

export const SAVE_STATE_LABELS: Record<SaveState, string> = {
  idle: 'No unsaved changes',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed — Retry',
  conflict: 'Conflict — review',
}

/**
 * The explicit button label. The spec renames "Save" to "Flush now" so the
 * author understands autosave is already running and the button is a demand
 * to flush *now*, not a permission to start saving.
 */
export const FLUSH_NOW_LABEL = 'Flush now'

/**
 * `aria-describedby` text for the disabled state. The spec is explicit:
 * the button is disabled with `aria-describedby="No unsaved changes"` when
 * the buffer is clean — never hidden, never a silent no-op.
 */
export const FLUSH_NOW_CLEAN_REASON = 'No unsaved changes'

/**
 * Whether the `Flush now` button is interactive. It is disabled when the
 * buffer is clean (`idle` / `saved`) or when a flush is already in flight
 * (`saving`). It is enabled when there is something to flush (`dirty`,
 * `error`, `conflict`).
 */
export function canFlushNow(state: SaveState): boolean {
  return state === 'dirty' || state === 'error' || state === 'conflict'
}

/**
 * The accessible label for the button in the given state. When disabled,
 * this is the `aria-describedby` text; when enabled, this is the action
 * label.
 */
export function flushNowAriaLabel(state: SaveState): string {
  if (!canFlushNow(state)) return FLUSH_NOW_CLEAN_REASON
  if (state === 'error') return 'Retry save now'
  if (state === 'conflict') return 'Review conflict'
  return FLUSH_NOW_LABEL
}

/**
 * Whether a `beforeunload` guard should be active. The spec mandates a
 * guard while the buffer is dirty *or* a flush is in flight — closing the
 * tab must not discard unsaved work, and a flush that has not yet been
 * acknowledged by the server must not be lost.
 */
export function shouldGuardBeforeUnload(state: SaveState): boolean {
  return state === 'dirty' || state === 'saving' || state === 'error' || state === 'conflict'
}

/**
 * The dirty-exit behaviour when switching items / tabs / settings sections.
 * The spec mandates: a dirty buffer flushes first; on failure, an S-7.1
 * dialog offers `Retry / Discard / Stay` (Discard is never the default; the
 * buffer is never discarded silently).
 *
 * This enum is the framework-free vocabulary; the React component owns the
 * dialog.
 */
export const DIRTY_EXIT_ACTIONS = ['flush-then-proceed', 'retry', 'discard', 'stay'] as const

export type DirtyExitAction = (typeof DIRTY_EXIT_ACTIONS)[number]

export const DIRTY_EXIT_LABELS: Record<DirtyExitAction, string> = {
  'flush-then-proceed': 'Save and proceed',
  retry: 'Retry',
  discard: 'Discard changes',
  stay: 'Stay',
}

/**
 * Default action for the dirty-exit dialog. The spec is explicit: Discard
 * is never the default. The default is `flush-then-proceed` when the flush
 * has a chance of succeeding, or `retry` after a failure.
 */
export function defaultDirtyExitAction(state: SaveState): DirtyExitAction {
  return state === 'error' ? 'retry' : 'flush-then-proceed'
}
