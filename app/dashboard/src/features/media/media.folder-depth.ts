/**
 * Folder depth cap + keyboard drag (spec 05 § S-3.4 Folders & Collections).
 *
 * The spec mandates:
 * - **Nesting caps at 2 levels.** A folder may contain folders, but not
 *   folders inside folders. Attempting a third level offers to create the
 *   folder as a **sibling** of the current one.
 * - **Drag is never the only route.** The row's `⋯` menu has Move to
 *   folder…, and drag has a keyboard mode: `Space` picks up, arrows move,
 *   `Space` drops, `Esc` cancels, with every position change announced in
 *   a live region.
 *
 * This module is framework-free: it owns the depth computation, the
 * depth-cap guard, and the keyboard-drag state machine.
 */

export const MAX_FOLDER_DEPTH = 2

export interface FolderNode {
  readonly id: string
  readonly parentId: string | null
  readonly name: string
}

/**
 * Compute the depth of a folder by walking the parent chain. Root folders
 * (parentId === null) are depth 1. A folder whose parent is a root folder
 * is depth 2. The spec caps at 2 levels, so depth 3 is forbidden.
 */
export function computeFolderDepth(
  folderId: string,
  folders: ReadonlyMap<string, FolderNode>,
): number {
  let depth = 1
  let current = folders.get(folderId)
  while (current?.parentId) {
    depth += 1
    current = folders.get(current.parentId)
    if (!current) break
  }
  return depth
}

export type DepthCheckResult =
  | { readonly kind: 'permitted' }
  | {
      readonly kind: 'depth_exceeded'
      readonly currentDepth: number
      readonly suggestedParentId: string | null
    }

/**
 * Check whether a subfolder can be created under `parentFolderId`. The
 * spec: "Folders nest 2 levels deep. Create {name} alongside {current}
 * instead?" — when the parent is already at depth 2, the new folder must
 * be a sibling of the parent (i.e., a child of the parent's parent).
 */
export function canCreateSubfolder(
  parentFolderId: string | null,
  folders: ReadonlyMap<string, FolderNode>,
): DepthCheckResult {
  if (parentFolderId === null) {
    // Root-level folder: always permitted (depth 1).
    return { kind: 'permitted' }
  }
  const parentDepth = computeFolderDepth(parentFolderId, folders)
  if (parentDepth >= MAX_FOLDER_DEPTH) {
    // Parent is at depth 2 (or deeper, which shouldn't happen but guard
    // anyway). Suggest creating as a sibling — i.e., under the parent's
    // parent.
    const parent = folders.get(parentFolderId)
    return {
      kind: 'depth_exceeded',
      currentDepth: parentDepth,
      suggestedParentId: parent?.parentId ?? null,
    }
  }
  return { kind: 'permitted' }
}

/**
 * The depth-exceeded message. The spec: "Folders nest 2 levels deep.
 * Create {name} alongside {current} instead?"
 */
export function depthExceededMessage(newFolderName: string, currentFolderName: string): string {
  return `Folders nest ${MAX_FOLDER_DEPTH} levels deep. Create ${newFolderName} alongside ${currentFolderName} instead?`
}

// ── Keyboard drag state machine ────────────────────────────────────────────

export type KeyboardDragState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'picked_up'; readonly assetId: string; readonly sourceFolderId: string | null }
  | { readonly kind: 'moving'; readonly assetId: string; readonly targetFolderId: string | null }
  | { readonly kind: 'dropped'; readonly assetId: string; readonly targetFolderId: string | null }

export type KeyboardDragAction =
  | { readonly type: 'pick_up'; readonly assetId: string; readonly sourceFolderId: string | null }
  | { readonly type: 'move'; readonly targetFolderId: string | null }
  | { readonly type: 'drop' }
  | { readonly type: 'cancel' }
  | { readonly type: 'reset' }

/**
 * The keyboard-drag state machine. The spec:
 * - `Space` picks up (announced)
 * - arrows move between folders
 * - `Space` drops
 * - `Esc` cancels and restores the original position
 *
 * Every position change is announced in a live region.
 */
export function keyboardDragReducer(
  state: KeyboardDragState,
  action: KeyboardDragAction,
): KeyboardDragState {
  switch (action.type) {
    case 'pick_up':
      if (state.kind !== 'idle') return state
      return {
        kind: 'picked_up',
        assetId: action.assetId,
        sourceFolderId: action.sourceFolderId,
      }
    case 'move':
      if (state.kind !== 'picked_up' && state.kind !== 'moving') return state
      return {
        kind: 'moving',
        assetId: state.assetId,
        targetFolderId: action.targetFolderId,
      }
    case 'drop': {
      if (state.kind !== 'picked_up' && state.kind !== 'moving') return state
      // Only `moving` has a targetFolderId; `picked_up` drops at the source.
      const dropTarget = state.kind === 'moving' ? state.targetFolderId : state.sourceFolderId
      return {
        kind: 'dropped',
        assetId: state.assetId,
        targetFolderId: dropTarget,
      }
    }
    case 'cancel':
      // Esc cancels and restores the original position.
      return { kind: 'idle' }
    case 'reset':
      return { kind: 'idle' }
    default:
      return state
  }
}

/**
 * The live-region announcement for the current drag state. The spec:
 * "every position change announced in a live region."
 */
export function keyboardDragAnnouncement(
  state: KeyboardDragState,
  folderNames: ReadonlyMap<string, string>,
): string {
  if (state.kind === 'idle') return ''
  if (state.kind === 'picked_up') {
    return `Picked up asset. Press arrows to move between folders, Space to drop, Esc to cancel.`
  }
  if (state.kind === 'moving') {
    const targetName = state.targetFolderId
      ? folderNames.get(state.targetFolderId)
      : 'Uncategorized'
    return `Moving to ${targetName}. Press Space to drop, Esc to cancel.`
  }
  // Remaining state.kind is 'dropped' (idle/picked_up/moving handled above).
  const droppedTargetName = state.targetFolderId
    ? folderNames.get(state.targetFolderId)
    : 'Uncategorized'
  return `Dropped into ${droppedTargetName}.`
}
