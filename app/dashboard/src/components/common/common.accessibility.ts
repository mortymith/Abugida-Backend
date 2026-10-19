/**
 * Spec 11 § Accessibility: keyboard drag parity.
 * Space picks up, arrows move, Space drops, Esc cancels.
 * Every position change is announced in a live region.
 */

export type KeyboardDragState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'picked_up'; readonly itemId: string; readonly sourcePosition: number }
  | { readonly kind: 'moving'; readonly itemId: string; readonly currentPosition: number }
  | { readonly kind: 'dropped'; readonly itemId: string; readonly finalPosition: number }

export type KeyboardDragAction =
  | { readonly type: 'pick_up'; readonly itemId: string; readonly position: number }
  | { readonly type: 'move'; readonly direction: 'up' | 'down' }
  | { readonly type: 'drop' }
  | { readonly type: 'cancel' }
  | { readonly type: 'reset' }

export function keyboardDragReducer(
  state: KeyboardDragState,
  action: KeyboardDragAction,
  totalItems: number,
): KeyboardDragState {
  switch (action.type) {
    case 'pick_up':
      if (state.kind !== 'idle') return state
      return { kind: 'picked_up', itemId: action.itemId, sourcePosition: action.position }
    case 'move': {
      if (state.kind !== 'picked_up' && state.kind !== 'moving') return state
      const currentPos = state.kind === 'moving' ? state.currentPosition : state.sourcePosition
      const newPos =
        action.direction === 'up'
          ? Math.max(0, currentPos - 1)
          : Math.min(totalItems - 1, currentPos + 1)
      return { kind: 'moving', itemId: state.itemId, currentPosition: newPos }
    }
    case 'drop': {
      if (state.kind !== 'picked_up' && state.kind !== 'moving') return state
      const finalPos = state.kind === 'moving' ? state.currentPosition : state.sourcePosition
      return { kind: 'dropped', itemId: state.itemId, finalPosition: finalPos }
    }
    case 'cancel':
      return { kind: 'idle' }
    case 'reset':
      return { kind: 'idle' }
    default:
      return state
  }
}

export function keyboardDragAnnouncement(
  state: KeyboardDragState,
  itemLabel: string,
  totalItems: number,
): string {
  if (state.kind === 'idle') return ''
  if (state.kind === 'picked_up') {
    return `Picked up ${itemLabel}. Press up or down to move, Space to drop, Esc to cancel.`
  }
  if (state.kind === 'moving') {
    return `${itemLabel}, position ${state.currentPosition + 1} of ${totalItems}. Press Space to drop, Esc to cancel.`
  }
  // Remaining state.kind is 'dropped' (idle/picked_up/moving handled above).
  return `${itemLabel} dropped at position ${state.finalPosition + 1}.`
}

/**
 * Spec 11 § Accessibility: prefers-reduced-motion.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
