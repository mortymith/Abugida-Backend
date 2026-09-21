import { createServerFn } from '@tanstack/react-start'
import {
  assetPublicIdSchema,
  assetVersionCompleteSchema,
  assetVersionInitSchema,
} from '../schemas/library.schema'

/**
 * Asset version history + "Upload New Version" / "Replace File" (S-3.3).
 * Version uploads presign under a per-asset version prefix; completion
 * swaps the asset's current pointer and re-syncs linked lessons.
 */
export const getAssetVersions = createServerFn({ method: 'GET' })
  .validator((input: unknown) => assetPublicIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { getAssetVersionsImpl } = await import('./library.versions.impl.server')
    return getAssetVersionsImpl(data.assetPublicId)
  })

export const uploadAssetVersion = createServerFn({ method: 'POST' })
  .validator((input: unknown) => assetVersionInitSchema.parse(input))
  .handler(
    async ({
      data,
    }): Promise<{
      objectKey: string
      uploadUrl: string
      versionNumber: number
      expiresIn: number
    }> => {
      const { uploadAssetVersionImpl } = await import('./library.versions.impl.server')
      return uploadAssetVersionImpl(data)
    },
  )

export const completeAssetVersion = createServerFn({ method: 'POST' })
  .validator((input: unknown) => assetVersionCompleteSchema.parse(input))
  .handler(async ({ data }): Promise<{ versionNumber: number }> => {
    const { completeAssetVersionImpl } = await import('./library.versions.impl.server')
    return completeAssetVersionImpl(data)
  })
