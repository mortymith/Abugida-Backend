import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  folderCreateSchema,
  folderDeleteSchema,
  folderRenameSchema,
  assetsMoveSchema,
} from '../schemas/library.schema'

/**
 * Folders & Collections (S-3.4): create/rename/delete folders, breadcrumb
 * trails, and moving assets between folders (drag-and-drop or context menu).
 */
export const listFolders = createServerFn({ method: 'GET' }).handler(async () => {
  const { listFoldersImpl } = await import('./library.folders.impl.server')
  return listFoldersImpl()
})

export const getFolderTrail = createServerFn({ method: 'GET' })
  .validator((input: unknown) => z.object({ folderPublicId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { getFolderTrailImpl } = await import('./library.folders.impl.server')
    return getFolderTrailImpl(data.folderPublicId)
  })

export const createFolder = createServerFn({ method: 'POST' })
  .validator((input: unknown) => folderCreateSchema.parse(input))
  .handler(async ({ data }): Promise<{ folderPublicId: string }> => {
    const { createFolderImpl } = await import('./library.folders.impl.server')
    return createFolderImpl(data)
  })

export const renameFolder = createServerFn({ method: 'POST' })
  .validator((input: unknown) => folderRenameSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { renameFolderImpl } = await import('./library.folders.impl.server')
    return renameFolderImpl(data)
  })

export const deleteFolder = createServerFn({ method: 'POST' })
  .validator((input: unknown) => folderDeleteSchema.parse(input))
  .handler(
    async ({ data }): Promise<{ ok: true; movedAssets: number; reparentedFolders: number }> => {
      const { deleteFolderImpl } = await import('./library.folders.impl.server')
      return deleteFolderImpl(data)
    },
  )

export const moveAssets = createServerFn({ method: 'POST' })
  .validator((input: unknown) => assetsMoveSchema.parse(input))
  .handler(async ({ data }): Promise<{ moved: number }> => {
    const { moveAssetsImpl } = await import('./library.folders.impl.server')
    return moveAssetsImpl(data)
  })
