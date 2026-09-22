import { createFileRoute } from '@tanstack/react-router'
import { AffiliatesView } from '#/features/marketing'

/** S-8.4 Affiliate Program. */
export const Route = createFileRoute('/_app/marketing/affiliates')({
  component: AffiliatesView,
})
