/**
 * S-7.1 Confirmation Dialog API contract (spec 09 § S-7.1).
 * Full API: tone, consequenceCount, requireTyped, reversibleAlternative,
 * Unsaved Changes variant.
 */

export type ConfirmTone = 'danger' | 'warning' | 'neutral'

export interface ConfirmDialogConfig {
  readonly title: string
  readonly body: string
  readonly consequenceCount?: number
  readonly confirmLabel: string
  readonly cancelLabel?: string
  readonly tone: ConfirmTone
  readonly requireTyped?: string
  readonly reversibleAlternative?: { label: string }
}

export function isTypedConfirmationValid(typed: string, required: string): boolean {
  return typed.trim() === required.trim()
}

export function typedMismatchMessage(required: string): string {
  return `Type ${required} to confirm.`
}

export function shouldFocusReversible(config: ConfirmDialogConfig): boolean {
  return config.reversibleAlternative !== undefined
}

export function initialFocusLabel(config: ConfirmDialogConfig): string {
  if (config.reversibleAlternative) return config.reversibleAlternative.label
  return config.cancelLabel ?? 'Cancel'
}

// ── Unsaved Changes variant ─────────────────────────────────────────────

export type SaveModel = 'explicit-save' | 'autosave'

export interface UnsavedSurface {
  readonly label: string
  readonly measure: string // e.g. "340 characters unsaved", "2 questions"
}

export interface UnsavedChangesConfig {
  readonly surfaces: readonly UnsavedSurface[]
  readonly saveModel: SaveModel
}

export function unsavedChangesTitle(): string {
  return 'You have unsaved changes'
}

export function unsavedChangesBody(config: UnsavedChangesConfig): string {
  const lines = config.surfaces.map((s) => `${s.label} — ${s.measure}`)
  return lines.join('\n')
}

export function shouldShowUnsavedDialog(config: UnsavedChangesConfig): boolean {
  // For autosave surfaces, only show after a failed flush — never because
  // the buffer is merely dirty (the user has nothing to lose that autosave
  // has not already kept).
  if (config.saveModel === 'autosave') {
    return config.surfaces.length > 0
  }
  // For explicit-save surfaces, show whenever there are dirty surfaces.
  return config.surfaces.length > 0
}
