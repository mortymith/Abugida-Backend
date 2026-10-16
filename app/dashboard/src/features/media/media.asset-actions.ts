/**
 * Asset actions menu (spec 05 § S-3.3 — the `⋯` menu).
 *
 * The spec orders the menu reversible-first:
 *
 * 1. Archive (reversible; hides it, breaks nothing)
 * 2. Move to folder…
 * 3. Detach from all items
 * — separator —
 * 4. Delete permanently (destructive; never the default)
 *
 * Archive is the primary action everywhere (spec 11 § Global Validation:
 * "the reversible option is always first"). Delete permanently is
 * visually separated below it, never adjacent to the reversible actions.
 *
 * This module is framework-free: it owns the menu structure and the
 * enablement rules. The React component renders the menu.
 */

export const ASSET_ACTION_IDS = [
  'archive',
  'restore',
  'move_to_folder',
  'detach_from_all',
  'delete_permanently',
] as const

export type AssetActionId = (typeof ASSET_ACTION_IDS)[number]

export const ASSET_ACTION_LABELS: Record<AssetActionId, string> = {
  archive: 'Archive',
  restore: 'Restore',
  move_to_folder: 'Move to folder…',
  detach_from_all: 'Detach from all items',
  delete_permanently: 'Delete permanently',
}

export interface AssetActionItem {
  readonly id: AssetActionId
  readonly label: string
  readonly destructive: boolean
  readonly disabled: boolean
  readonly disabledReason?: string
  readonly separatorBefore?: boolean
}

export interface AssetActionsContext {
  readonly isArchived: boolean
  readonly useCount: number
  readonly canEdit: boolean
}

/**
 * Build the ordered `⋯` menu for an asset. The structure follows the
 * spec's reversible-first ordering with a separator before the
 * destructive action.
 *
 * Rules:
 * - When `isArchived`, the menu shows **Restore** (not Archive) and
 *   nothing else — an archived asset is read-only except for restore.
 * - When `useCount === 0`, Detach is absent (nothing to detach).
 * - When `canEdit` is false, all actions are absent (case 1 of the
 *   permission rule — the control does not render at all).
 */
export function buildAssetActionsMenu(ctx: AssetActionsContext): AssetActionItem[] {
  // Viewer/Support: controls absent, not disabled (case 1).
  if (!ctx.canEdit) return []

  // Archived: Restore only.
  if (ctx.isArchived) {
    return [
      { id: 'restore', label: ASSET_ACTION_LABELS.restore, destructive: false, disabled: false },
    ]
  }

  const items: AssetActionItem[] = [
    { id: 'archive', label: ASSET_ACTION_LABELS.archive, destructive: false, disabled: false },
    {
      id: 'move_to_folder',
      label: ASSET_ACTION_LABELS.move_to_folder,
      destructive: false,
      disabled: false,
    },
  ]

  // Detach only when there are usages.
  if (ctx.useCount > 0) {
    items.push({
      id: 'detach_from_all',
      label: ASSET_ACTION_LABELS.detach_from_all,
      destructive: false,
      disabled: false,
    })
  }

  // Separator before the destructive action.
  items.push({
    id: 'delete_permanently',
    label: ASSET_ACTION_LABELS.delete_permanently,
    destructive: true,
    disabled: false,
    separatorBefore: true,
  })

  return items
}

/**
 * Whether an action requires an S-7.1 confirmation dialog. The spec
 * requires confirmation for Delete and Detach; Archive and Move are
 * optimistic (with Undo for Archive).
 */
export function requiresConfirmation(action: AssetActionId): boolean {
  return action === 'delete_permanently' || action === 'detach_from_all'
}

/**
 * Whether an action is reversible. Archive is reversible (Restore).
 * Move is reversible (move back). Detach is semi-reversible (re-attach).
 * Delete permanently is not reversible.
 */
export function isReversible(action: AssetActionId): boolean {
  return action === 'archive' || action === 'move_to_folder'
}
