import { createServerFn } from '@tanstack/react-start'
import { catalogQuerySchema } from '../schemas/courses.catalog.schema'
import type { CourseCatalogResult } from '../courses.types'

/** S-2.1 Course Catalog feed: filtered/sorted/paginated course cards. */
export const getCourseCatalog = createServerFn({ method: 'GET' })
  .validator((input: unknown) => catalogQuerySchema.parse(input))
  .handler(async ({ data }): Promise<CourseCatalogResult> => {
    const { loadCourseCatalog } = await import('./courses.catalog.impl.server')
    return loadCourseCatalog(data)
  })
