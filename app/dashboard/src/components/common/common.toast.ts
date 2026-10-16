/**
 * S-7.2 Toast Notifications expansion (spec 09 § S-7.2).
 * Undo toast API (10s timed action), status vs alert ARIA roles,
 * error never auto-dismisses.
 */

export type ToastType = 'success' | 'info' | 'warning' | 'error'

export const TOAST_AUTO_DISMISS_MS = 5000
export const UNDO_TOAST_DURATION_MS = 10_000
export const MAX_VISIBLE_TOASTS = 3

export function toastAriaRole(type: ToastType): 'status' | 'alert' {
  if (type === 'error') return 'alert'
  return 'status'
}

export function shouldAutoDismiss(type: ToastType): boolean {
  if (type === 'error') return false
  if (type === 'warning') return false
  return true
}

export function toastDurationMs(type: ToastType, hasAction: boolean = false): number | null {
  if (hasAction) return null // action toasts never auto-dismiss while focused
  if (!shouldAutoDismiss(type)) return null
  return TOAST_AUTO_DISMISS_MS
}

export interface UndoToastConfig {
  readonly action: string // e.g. "Archived"
  readonly undoLabel: string // e.g. "Undo archive"
}

export function undoToastAnnouncement(config: UndoToastConfig): string {
  return `${config.action}. Undo available for 10 seconds`
}

export function undoTimeRemainingMs(startedAt: number, now: number): number {
  return Math.max(0, UNDO_TOAST_DURATION_MS - (now - startedAt))
}

export function isUndoExpired(startedAt: number, now: number): boolean {
  return now - startedAt >= UNDO_TOAST_DURATION_MS
}

export function shouldPauseTimer(isHovered: boolean, isFocused: boolean): boolean {
  return isHovered || isFocused
}
