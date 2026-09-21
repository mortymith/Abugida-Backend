import { createServerFn } from '@tanstack/react-start'
import { assetUploadInitSchema, readUrlSchema } from '../schemas/library.schema'

/**
 * Presigned upload/read URLs for Content Library assets (S-3.2/S-3.3/S-3.5).
 * Mirrors the established courses storage bridge: the browser PUTs directly
 * to object storage; the server persists only metadata + object keys.
 */
export const getAssetUploadUrl = createServerFn({ method: 'POST' })
  .validator((input: unknown) => assetUploadInitSchema.parse(input))
  .handler(
    async ({ data }): Promise<{ objectKey: string; uploadUrl: string; expiresIn: number }> => {
      const { getAssetUploadUrlImpl } = await import('./library.presign.impl.server')
      return getAssetUploadUrlImpl(data)
    },
  )

export const getAssetReadUrl = createServerFn({ method: 'GET' })
  .validator((input: unknown) => readUrlSchema.parse(input))
  .handler(async ({ data }): Promise<{ url: string | null }> => {
    const { getAssetReadUrlImpl } = await import('./library.presign.impl.server')
    return getAssetReadUrlImpl(data)
  })
