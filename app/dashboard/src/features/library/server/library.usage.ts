import { createServerFn } from '@tanstack/react-start'
import { assetPublicIdSchema } from '../schemas/library.schema'

/**
 * Asset usage (S-3.1 "N uses", S-3.3 "Used In"). Read wrappers live here;
 * the link/unlink helpers consumed by the lesson save flow are internal to
 * the impl module so no other feature can bypass the transaction rules.
 */
export const getAssetUsage = createServerFn({ method: 'GET' })
  .validator((input: unknown) => assetPublicIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { getAssetUsageImpl } = await import('./library.usage.impl.server')
    return getAssetUsageImpl(data.assetPublicId)
  })
