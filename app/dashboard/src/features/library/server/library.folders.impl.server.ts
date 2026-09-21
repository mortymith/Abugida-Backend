/**
 * Server-only implementation of S-3.4 Folders & Collections. Deletion
 * redistributes contents (assets → uncategorized, direct child folders →
 * the deleted folder's parent) per the spec confirmation copy.
 */
import { and, eq, inArray, isNull, ne, sql } from '@abugida/database'
import { assetFolders, assetLibrary } from '@abugida/database/catalog'
import { db } from '#/config/db.config'
import { requireLibraryWriteRole, requireUserId } from './library.server-helpers.server'
import type { LibraryFolderNode } from '../library.types'
import type { z } from 'zod'
import type {
  AssetsMoveInput,
  FolderCreateInput,
  folderDeleteSchema,
  folderRenameSchema,
} from '../schemas/library.schema'

type FolderRenameInput = z.infer<typeof folderRenameSchema>
type FolderDeleteInput = z.infer<typeof folderDeleteSchema>

async function activeFolders() {
  return db
    .select({
      id: assetFolders.id,
      publicId: assetFolders.publicId,
      name: assetFolders.name,
      parentId: assetFolders.parentId,
    })
    .from(assetFolders)
    .where(isNull(assetFolders.deletedAt))
    .orderBy(assetFolders.name)
}

export async function listFoldersImpl(): Promise<LibraryFolderNode[]> {
  await requireUserId()
  const folders = await activeFolders()
  if (folders.length === 0) return []

  const counts = await db
    .select({
      folderId: assetLibrary.folderId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(assetLibrary)
    .where(isNull(assetLibrary.deletedAt))
    .groupBy(assetLibrary.folderId)
  const countByFolderId = new Map(
    counts.filter((row) => row.folderId != null).map((row) => [row.folderId as number, row.count]),
  )
  const idToPublic = new Map(folders.map((folder) => [folder.id, folder.publicId]))

  return folders.map((folder) => ({
    publicId: folder.publicId,
    name: folder.name,
    parentId: folder.parentId != null ? (idToPublic.get(folder.parentId) ?? null) : null,
    assetCount: countByFolderId.get(folder.id) ?? 0,
  }))
}

export async function getFolderTrailImpl(
  folderPublicId: string,
): Promise<{ publicId: string; name: string; parentId: string | null }[]> {
  await requireUserId()
  const folders = await activeFolders()
  const byPublic = new Map(folders.map((folder) => [folder.publicId, folder]))
  const idToPublic = new Map(folders.map((folder) => [folder.id, folder.publicId]))
  const trail: { publicId: string; name: string; parentId: string | null }[] = []
  let cursor = byPublic.get(folderPublicId)
  let steps = 0
  while (cursor && steps < 10) {
    steps += 1
    trail.unshift({
      publicId: cursor.publicId,
      name: cursor.name,
      parentId: cursor.parentId != null ? (idToPublic.get(cursor.parentId) ?? null) : null,
    })
    cursor =
      cursor.parentId != null ? byPublic.get(idToPublic.get(cursor.parentId) ?? '') : undefined
  }
  return trail
}

async function folderNameExists(name: string, parentId: number | null): Promise<boolean> {
  const rows = await db
    .select({ id: assetFolders.id })
    .from(assetFolders)
    .where(
      and(
        isNull(assetFolders.deletedAt),
        sql`LOWER(${assetFolders.name}) = LOWER(${name})`,
        parentId == null ? isNull(assetFolders.parentId) : eq(assetFolders.parentId, parentId),
      ),
    )
    .limit(1)
  return rows.length > 0
}

async function folderIdFromPublicId(publicId: string): Promise<number> {
  const rows = await db
    .select({ id: assetFolders.id })
    .from(assetFolders)
    .where(and(eq(assetFolders.publicId, publicId), isNull(assetFolders.deletedAt)))
    .limit(1)
  const folder = rows.at(0)
  if (!folder) throw new Error('FOLDER_NOT_FOUND')
  return folder.id
}

export async function createFolderImpl(input: FolderCreateInput): Promise<{
  folderPublicId: string
}> {
  const userId = await requireLibraryWriteRole()
  const parentId = input.parentId ? await folderIdFromPublicId(input.parentId) : null
  if (await folderNameExists(input.name, parentId)) {
    throw new Error('FOLDER_NAME_TAKEN: a folder with this name already exists here')
  }
  const inserted = await db
    .insert(assetFolders)
    .values({ name: input.name, parentId, createdBy: userId })
    .returning({ publicId: assetFolders.publicId })
  const created = inserted.at(0)
  if (!created) throw new Error('FOLDER_CREATE_FAILED')
  return { folderPublicId: created.publicId }
}

export async function renameFolderImpl(input: FolderRenameInput): Promise<{ ok: true }> {
  await requireLibraryWriteRole()
  const folderId = await folderIdFromPublicId(input.folderPublicId)
  const rows = await db
    .select({ parentId: assetFolders.parentId })
    .from(assetFolders)
    .where(eq(assetFolders.id, folderId))
    .limit(1)
  const parentId = rows.at(0)?.parentId ?? null
  const clash = await db
    .select({ id: assetFolders.id })
    .from(assetFolders)
    .where(
      and(
        isNull(assetFolders.deletedAt),
        ne(assetFolders.id, folderId),
        sql`LOWER(${assetFolders.name}) = LOWER(${input.name})`,
        parentId == null ? isNull(assetFolders.parentId) : eq(assetFolders.parentId, parentId),
      ),
    )
    .limit(1)
  if (clash.length > 0) {
    throw new Error('FOLDER_NAME_TAKEN: a folder with this name already exists here')
  }
  await db.update(assetFolders).set({ name: input.name }).where(eq(assetFolders.id, folderId))
  return { ok: true }
}

export async function deleteFolderImpl(input: FolderDeleteInput): Promise<{
  ok: true
  movedAssets: number
  reparentedFolders: number
}> {
  await requireLibraryWriteRole()
  const folderId = await folderIdFromPublicId(input.folderPublicId)

  const rows = await db
    .select({ parentId: assetFolders.parentId })
    .from(assetFolders)
    .where(eq(assetFolders.id, folderId))
    .limit(1)
  const grandParentId = rows.at(0)?.parentId ?? null

  const assetCountRows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(assetLibrary)
    .where(and(eq(assetLibrary.folderId, folderId), isNull(assetLibrary.deletedAt)))
  const movedAssets = assetCountRows.at(0)?.count ?? 0

  const childRows = await db
    .select({ id: assetFolders.id })
    .from(assetFolders)
    .where(and(eq(assetFolders.parentId, folderId), isNull(assetFolders.deletedAt)))
  const reparentedFolders = childRows.length

  await db.transaction(async (tx) => {
    // Assets drop to "Uncategorized" (spec: "Move 12 assets to Uncategorized?").
    await tx
      .update(assetLibrary)
      .set({ folderId: null })
      .where(and(eq(assetLibrary.folderId, folderId), isNull(assetLibrary.deletedAt)))
    // Direct children move up to the deleted folder's parent.
    if (childRows.length > 0) {
      await tx
        .update(assetFolders)
        .set({ parentId: grandParentId })
        .where(
          inArray(
            assetFolders.id,
            childRows.map((row) => row.id),
          ),
        )
    }
    await tx
      .update(assetFolders)
      .set({ deletedAt: new Date() })
      .where(eq(assetFolders.id, folderId))
  })

  return { ok: true, movedAssets, reparentedFolders }
}

export async function moveAssetsImpl(input: AssetsMoveInput): Promise<{ moved: number }> {
  await requireLibraryWriteRole()
  const folderId = input.folderId ? await folderIdFromPublicId(input.folderId) : null

  const updated = await db
    .update(assetLibrary)
    .set({ folderId })
    .where(
      and(inArray(assetLibrary.publicId, input.assetPublicIds), isNull(assetLibrary.deletedAt)),
    )
    .returning({ id: assetLibrary.id })
  return { moved: updated.length }
}
