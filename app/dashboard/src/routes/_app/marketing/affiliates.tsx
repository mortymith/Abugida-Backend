import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AffiliatesView } from '#/features/marketing'

/** S-8.4 Affiliate Program. */
const affiliatesSearchSchema = z.object({
  status: z.enum(['all', 'pending', 'approved', 'suspended', 'declined']).default('all'),
})

export const Route = createFileRoute('/_app/marketing/affiliates')({
  validateSearch: affiliatesSearchSchema,
  component: AffiliatesPage,
})

function AffiliatesPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <AffiliatesView
      status={search.status}
      onStatusChange={(status) =>
        void navigate({ search: (prev) => ({ ...prev, status: status as typeof prev.status }) })
      }
    />
  )
}
