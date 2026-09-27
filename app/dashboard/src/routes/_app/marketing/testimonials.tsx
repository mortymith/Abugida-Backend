import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { TestimonialsView } from '#/features/marketing'

/** S-8.5 Student Testimonials — moderation queue and published list. */
const testimonialsSearchSchema = z.object({
  status: z.enum(['pending', 'published']).default('pending'),
  course: z.union([z.literal('all'), z.string().uuid()]).default('all'),
})

export const Route = createFileRoute('/_app/marketing/testimonials')({
  validateSearch: testimonialsSearchSchema,
  component: TestimonialsPage,
})

function TestimonialsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <TestimonialsView
      query={{ status: search.status, course: search.course }}
      onQueryChange={(query) => void navigate({ search: (prev) => ({ ...prev, ...query }) })}
    />
  )
}
