import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { CampaignsView } from '#/features/marketing'

/**
 * S-8.1 Email Campaigns. Supports the S-4.4 deep link with a pre-filtered
 * audience cohort (`?cohort=<publicId>`).
 */
const campaignsSearchSchema = z.object({
  status: z.enum(['all', 'draft', 'scheduled', 'sending', 'sent', 'cancelled']).default('all'),
  cohort: z.string().uuid().optional(),
})

export const Route = createFileRoute('/_app/marketing/campaigns')({
  validateSearch: campaignsSearchSchema,
  component: CampaignsPage,
})

function CampaignsPage() {
  const search = Route.useSearch()
  return <CampaignsView query={{ status: search.status }} prefillCohort={search.cohort} />
}
