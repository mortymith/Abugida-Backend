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
