import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { GlobalSearchPayload } from '../search.types'

/**
 * Server function for S-1.3 Global Search. Implementation lives in the
 * server-only impl module, dynamically imported inside the handler so this
 * file stays safe for the client bundle.
 */
const globalSearchInputSchema = z.object({
  query: z.string().trim().min(2).max(100),
})

export const getGlobalSearch = createServerFn({ method: 'GET' })
  .validator((input: unknown) => globalSearchInputSchema.parse(input))
  .handler(async ({ data }): Promise<GlobalSearchPayload> => {
    const { loadGlobalSearch } = await import('./search.global.impl.server')
    return loadGlobalSearch(data)
  })
