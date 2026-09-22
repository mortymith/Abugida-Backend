import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { BrandingSettings, BrandingUploadUrl } from '../settings.types'
import { brandingUploadSchema, saveBrandingSchema } from '../schemas/settings.schema'

/**
 * Client-safe S-6.4 Branding server functions. Uploads use presigned URLs
 * (browser → MinIO/S3) via @abugida/storage — same pattern as Content Library.
 */

export const getBranding = createServerFn({ method: 'GET' }).handler(
  async (): Promise<BrandingSettings> => {
    const { getBrandingImpl } = await import('./settings.branding.impl.server')
    return getBrandingImpl()
  },
)

export const saveBranding = createServerFn({ method: 'POST' })
  .validator((input: unknown) => saveBrandingSchema.parse(input))
  .handler(async ({ data }) => {
    const { saveBrandingImpl } = await import('./settings.branding.impl.server')
    return saveBrandingImpl(data)
  })

export const resetBranding = createServerFn({ method: 'POST' }).handler(async () => {
  const { resetBrandingImpl } = await import('./settings.branding.impl.server')
  return resetBrandingImpl()
})

export const getBrandingUploadUrl = createServerFn({ method: 'POST' })
  .validator((input: unknown) => brandingUploadSchema.parse(input))
  .handler(async ({ data }): Promise<BrandingUploadUrl> => {
    const { getBrandingUploadUrlImpl } = await import('./settings.branding.impl.server')
    return getBrandingUploadUrlImpl(data)
  })

export const getBrandingAssetUrl = createServerFn({ method: 'POST' })
  .validator((input: unknown) => z.string().trim().min(1).max(500).parse(input))
  .handler(async ({ data }): Promise<{ url: string | null }> => {
    const { getBrandingAssetUrlImpl } = await import('./settings.branding.impl.server')
    return getBrandingAssetUrlImpl(data)
  })
