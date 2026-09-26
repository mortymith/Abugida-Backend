/**
 * Folder tree rules for S-3.4 (pure logic — unit-tested): breadcrumb trails,
 * move-into-own-descendant rejection, and delete redistribution (assets →
 * uncategorized, child folders → the deleted folder's parent).
 */

export interface FolderLike {
  publicId: string
  name: string
  parentId: string | null
}

/** Root → … → folder ancestor chain for the breadcrumb. */
export function buildTrail(folders: FolderLike[], folderPublicId: string): FolderLike[] {
  const byId = new Map(folders.map((folder) => [folder.publicId, folder]))
  const trail: FolderLike[] = []
  let cursor = byId.get(folderPublicId)
  const guard = new Set<string>()
  while (cursor && !guard.has(cursor.publicId)) {
    guard.add(cursor.publicId)
    trail.unshift(cursor)
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }
  return trail
}

/** Moving a folder under one of its own descendants would orphan the tree. */
export function isMoveIntoDescendant(
  folders: FolderLike[],
  folderPublicId: string,
  targetParentId: string | null,
): boolean {
  if (targetParentId == null) return false
  if (folderPublicId === targetParentId) return true
  const byId = new Map(folders.map((folder) => [folder.publicId, folder]))
  let cursor = byId.get(targetParentId)
  const guard = new Set<string>()
  while (cursor && !guard.has(cursor.publicId)) {
    guard.add(cursor.publicId)
    if (cursor.publicId === folderPublicId) return true
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }
  return false
}

export interface FolderDeletePlan {
  /** Folders that get reparented (children of the deleted folder). */
  reparentedFolderIds: string[]
  /** Assets that drop to "Uncategorized" (folderId → null). */
  assetCountInside: number
}

/**
 * Computes the delete outcome (spec: "Move 12 assets to Uncategorized?").
 * The server applies this plan in one transaction.
 */
export function planFolderDelete(
  folders: FolderLike[],
  folderPublicId: string,
  assetCountInside: number,
): FolderDeletePlan | null {
  const target = folders.find((folder) => folder.publicId === folderPublicId)
  if (!target) return null
  const guard = new Set<string>()
  const collectDescendants = (parentId: string, acc: string[]): void => {
    if (guard.has(parentId)) return
    guard.add(parentId)
    folders
      .filter((folder) => folder.parentId === parentId)
      .forEach((child) => {
        acc.push(child.publicId)
        collectDescendants(child.publicId, acc)
      })
  }
  const descendants: string[] = []
  collectDescendants(folderPublicId, descendants)
  return {
    // Children move up to the deleted folder's parent (null → root).
    reparentedFolderIds: descendants.filter((id) => {
      const folder = folders.find((candidate) => candidate.publicId === id)
      return folder?.parentId === folderPublicId
    }),
    assetCountInside,
  }
}

/**
 * The view to fall back to after a folder delete: the deleted folder's parent
 * when it sits in the current breadcrumb trail, `'all'` when it is the folder
 * in view or the root of the trail, `null` when the delete does not affect the
 * current view at all.
 *
 * Without this, deleting an ancestor of the open folder (reachable from the
 * breadcrumb) left `activeFolder` pointing at a folder the user can no longer
 * reach from the UI.
 */
export function viewAfterFolderDelete(
  trail: readonly { publicId: string }[],
  activeFolder: string,
  deletedPublicId: string,
): string | null {
  if (deletedPublicId === activeFolder) return 'all'
  const index = trail.findIndex((step) => step.publicId === deletedPublicId)
  if (index === -1) return null
  return trail[index - 1]?.publicId ?? 'all'
}

/** Impact copy for the folder delete confirmation (spec 05 S-3.4). */
export function describeFolderDelete(assetCount: number, childFolderCount: number): string {
  const parts: string[] = []
  if (assetCount > 0) {
    parts.push(`${assetCount} asset${assetCount === 1 ? '' : 's'} will move to Uncategorized.`)
  }
  if (childFolderCount > 0) {
    parts.push(
      `${childFolderCount} subfolder${childFolderCount === 1 ? '' : 's'} will move to this folder’s parent.`,
    )
  }
  if (parts.length === 0) return 'This folder is empty. Deleting it cannot be undone.'
  return parts.join(' ')
}
