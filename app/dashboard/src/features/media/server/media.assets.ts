import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  assetDeleteSchema,
  assetDuplicateSchema,
  assetMetadataUpdateSchema,
  assetUploadCompleteSchema,
  mediaListQuerySchema,
} from '../schemas/media.schema'

/**
 * Media asset lifecycle (S-3.1/S-3.2/S-3.3): listing, stats,
 * upload completion (head-verified), metadata editing, duplication and
 * deletion. Thin client-safe wrappers — impl lives in *.impl.server.ts.
 */
export const getLibraryAssets = createServerFn({ method: 'GET' })
  .validator((input: unknown) => mediaListQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const { getLibraryAssetsImpl } = await import('./media.assets.impl.server')
    return getLibraryAssetsImpl(data)
  })

export const getLibraryStats = createServerFn({ method: 'GET' }).handler(async () => {
  const { getLibraryStatsImpl } = await import('./media.assets.impl.server')
  return getLibraryStatsImpl()
})

export const getAssetDetail = createServerFn({ method: 'GET' })
  .validator((input: unknown) => z.object({ assetPublicId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { getAssetDetailImpl } = await import('./media.assets.impl.server')
    return getAssetDetailImpl(data.assetPublicId)
  })

export const completeAssetUpload = createServerFn({ method: 'POST' })
  .validator((input: unknown) => assetUploadCompleteSchema.parse(input))
  .handler(async ({ data }): Promise<{ assetPublicId: string; replaced: boolean }> => {
    const { completeAssetUploadImpl } = await import('./media.assets.impl.server')
    return completeAssetUploadImpl(data)
  })

export const updateAssetMetadata = createServerFn({ method: 'POST' })
  .validator((input: unknown) => assetMetadataUpdateSchema.parse(input))
  .handler(async ({ data }) => {
    const { updateAssetMetadataImpl } = await import('./media.assets.impl.server')
    return updateAssetMetadataImpl(data)
  })

export const deleteAsset = createServerFn({ method: 'POST' })
  .validator((input: unknown) => assetDeleteSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { deleteAssetImpl } = await import('./media.assets.impl.server')
    return deleteAssetImpl(data)
  })

export const duplicateAsset = createServerFn({ method: 'POST' })
  .validator((input: unknown) => assetDuplicateSchema.parse(input))
  .handler(async ({ data }): Promise<{ assetPublicId: string }> => {
    const { duplicateAssetImpl } = await import('./media.assets.impl.server')
    return duplicateAssetImpl(data)
  })
