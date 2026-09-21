import { createFileRoute } from '@tanstack/react-router'
import { CoursesCatalog } from '#/features/courses'

export interface CatalogSearch {
  search?: string
  status?: string
  type?: string
  sort?: string
}

export const Route = createFileRoute('/_app/courses/')({
  validateSearch: (search: Record<string, unknown>): CatalogSearch => ({
    search: typeof search.search === 'string' ? search.search : undefined,
    status: typeof search.status === 'string' ? search.status : undefined,
    type: typeof search.type === 'string' ? search.type : undefined,
    sort: typeof search.sort === 'string' ? search.sort : undefined,
  }),
  component: CoursesCatalog,
})
