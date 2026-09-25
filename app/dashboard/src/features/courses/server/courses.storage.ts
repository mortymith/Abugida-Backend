import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const uploadUrlInput = z.object({
  kind: z.enum(['course_thumbnail', 'certificate_signature']),
  fileName: z.string().trim().min(1).max(300),
  contentType: z.string().trim().min(1).max(100),
})

/**
 * Presigned upload URL for course images (S-2.2 thumbnail, S-2.10 signature).
 * The client PUTs the file straight to object storage; we persist only the
 * object key. Throws STORAGE_NOT_CONFIGURED when env is absent (UI degrades).
 */
export const getImageUploadUrl = createServerFn({ method: 'POST' })
  .validator((input: unknown) => uploadUrlInput.parse(input))
  .handler(
    async ({ data }): Promise<{ objectKey: string; uploadUrl: string; expiresIn: number }> => {
      const { getImageUploadUrlImpl } = await import('./courses.storage.impl.server')
      return getImageUploadUrlImpl(data)
    },
  )

/** Short-lived read URL for a stored image (thumbnails, signatures). */
export const getImageReadUrl = createServerFn({ method: 'GET' })
  .validator((input: unknown) =>
    z.object({ objectKey: z.string().trim().min(1).max(500) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ url: string | null }> => {
    const { getImageReadUrlImpl } = await import('./courses.storage.impl.server')
    return getImageReadUrlImpl(data.objectKey)
  })
