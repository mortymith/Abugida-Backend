/**
 * Preview modal logic (spec 05 § S-3.5 File Preview Modal).
 *
 * The spec mandates:
 * - **Unsupported Format** vs **Preview Failed** distinction. Unsupported
 *   is a decision made before trying (".docx files can't be previewed
 *   here"). Preview Failed is a failure that actually happened, with a
 *   request ID.
 * - **Folder-boundary** disabled-with-reason. _Next_ on the last asset is
 *   disabled with "Last asset in TOEFL Speaking.", not hidden.
 * - **Focus return** to the triggering control on close, including when
 *   the asset was changed with Next/Prev (decision D9).
 * - **Esc rules**: from chrome closes the modal; from inside a text input
 *   or dropdown closes only that, not the whole modal.
 *
 * This module is framework-free: it owns the format-support decision, the
 * folder-boundary guard, the focus-return tracking, and the Esc-routing
 * logic.
 */

export type PreviewMediaKind = 'video' | 'image' | 'pdf' | 'audio' | 'unsupported'

export type PreviewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly mediaKind: PreviewMediaKind }
  | { readonly kind: 'unsupported_format'; readonly reason: string }
  | { readonly kind: 'preview_failed'; readonly requestId: string; readonly reason: string }
  | { readonly kind: 'no_captions' }
  | { readonly kind: 'streaming' }

/**
 * Classify a file by its MIME type into a preview media kind. Files that
 * cannot be previewed inline return `unsupported` — the modal shows
 * "Preview not available. Download to view." with the reason named.
 */
export function classifyMediaKind(
  mimeType: string | null,
  fileName: string | null,
): PreviewMediaKind {
  if (!mimeType) {
    return inferKindFromExtension(fileName)
  }
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType.startsWith('audio/')) return 'audio'
  return inferKindFromExtension(fileName)
}

function inferKindFromExtension(fileName: string | null): PreviewMediaKind {
  if (!fileName) return 'unsupported'
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (['mp4', 'webm', 'ogv', 'mov'].includes(ext)) return 'video'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio'
  return 'unsupported'
}

/**
 * The unsupported-format reason. The spec: ".docx files can't be
 * previewed here." — the extension is named in the message.
 */
export function unsupportedFormatReason(fileName: string | null, mimeType: string | null): string {
  const ext = fileName?.split('.').pop()
  if (ext) return `.${ext} files can't be previewed here.`
  if (mimeType) return `${mimeType} files can't be previewed here.`
  return "This file type can't be previewed here."
}

// ── Folder-boundary ────────────────────────────────────────────────────────

export interface FolderBoundaryResult {
  readonly canNavigate: boolean
  readonly reason: string | null
}

/**
 * Whether the Next/Prev navigation is permitted at a folder boundary.
 * The spec: _Next_ on the last asset is **disabled with a reason**
 * ("Last asset in TOEFL Speaking."), not hidden and not a silent no-op.
 *
 * The first asset in the folder similarly disables Prev with "First
 * asset in {folder}."
 */
export function checkFolderBoundary(
  direction: 'next' | 'prev',
  currentIndex: number,
  siblingCount: number,
  folderName: string,
): FolderBoundaryResult {
  if (direction === 'next') {
    if (currentIndex >= siblingCount - 1) {
      return {
        canNavigate: false,
        reason: `Last asset in ${folderName}.`,
      }
    }
  } else {
    if (currentIndex <= 0) {
      return {
        canNavigate: false,
        reason: `First asset in ${folderName}.`,
      }
    }
  }
  return { canNavigate: true, reason: null }
}

// ── Esc routing ────────────────────────────────────────────────────────────

export type EscTarget = 'modal_chrome' | 'text_input' | 'dropdown' | 'transcript_panel'

/**
 * Decide what `Esc` closes based on the current focus target. The spec:
 * - From the modal chrome → closes the modal.
 * - From inside a text input or dropdown → closes only that, not the
 *   whole modal.
 * - From the transcript panel → closes the panel first, then the modal.
 */
export function routeEscKey(target: EscTarget): {
  close: 'modal' | 'panel' | 'input' | 'dropdown'
  preventModalClose: boolean
} {
  switch (target) {
    case 'modal_chrome':
      return { close: 'modal', preventModalClose: false }
    case 'text_input':
      return { close: 'input', preventModalClose: true }
    case 'dropdown':
      return { close: 'dropdown', preventModalClose: true }
    case 'transcript_panel':
      return { close: 'panel', preventModalClose: true }
  }
}

// ── Focus return ───────────────────────────────────────────────────────────

/**
 * The focus-return contract. The spec: "focus returns to the control
 * that opened it, including when the asset was changed with Next."
 *
 * The React component stores a ref to the triggering control when the
 * modal opens. On close, it calls `focus()` on that ref. This module
 * owns the contract documentation; the component owns the ref.
 */
export const FOCUS_RETURN_CONTRACT = `On close, focus must return to the exact control that opened the modal. When the user navigated with Next/Prev, focus still returns to the ORIGINAL triggering control (the grid card that opened the modal), not to the new asset's card.`

// ── Keyboard shortcuts ─────────────────────────────────────────────────────

export const PREVIEW_KEYBOARD_SHORTCUTS: Readonly<
  Record<PreviewMediaKind, ReadonlyArray<{ keys: string; action: string }>>
> = {
  video: [
    { keys: 'Space / K', action: 'Play / pause' },
    { keys: '← / →', action: 'Seek 5 s' },
    { keys: '↑ / ↓', action: 'Volume' },
    { keys: 'M', action: 'Mute' },
    { keys: 'F', action: 'Fullscreen' },
    { keys: 'C', action: 'Captions' },
  ],
  audio: [
    { keys: 'Space / K', action: 'Play / pause' },
    { keys: '← / →', action: 'Seek 5 s' },
    { keys: '↑ / ↓', action: 'Volume' },
    { keys: 'M', action: 'Mute' },
  ],
  pdf: [
    { keys: '← / → / PageUp / PageDown', action: 'Navigate pages' },
    { keys: 'Ctrl/⌘ + / Ctrl/⌘ -', action: 'Zoom' },
  ],
  image: [
    { keys: '+ / -', action: 'Zoom' },
    { keys: '0', action: 'Reset zoom' },
  ],
  unsupported: [],
} as const

/**
 * Whether a keyboard shortcut applies to the current media kind. Used to
 * prevent shortcuts from firing when the focus is in a text input (where
 * `Space` should type a space, not toggle playback).
 */
export function shortcutApplies(mediaKind: PreviewMediaKind, isFocusInInput: boolean): boolean {
  if (isFocusInInput) return false
  return mediaKind !== 'unsupported'
}
