import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * `/marketing` lands on Email Campaigns — the first screen of the spec 10
 * Marketing group (S-8.1). The sidebar entry points here.
 */
export const Route = createFileRoute('/_app/marketing/')({
  beforeLoad: () => {
    throw redirect({ to: '/marketing/campaigns' })
  },
})
