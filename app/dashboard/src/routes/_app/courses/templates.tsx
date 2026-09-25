import { createFileRoute } from '@tanstack/react-router'
import { TemplateGallery } from '#/features/courses'

export const Route = createFileRoute('/_app/courses/templates')({
  validateSearch: (search: Record<string, unknown>): { search?: string; category?: string } => ({
    search: typeof search.search === 'string' ? search.search : undefined,
    category: typeof search.category === 'string' ? search.category : undefined,
  }),
  component: TemplateGallery,
})
