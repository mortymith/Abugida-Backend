import { createFileRoute } from '@tanstack/react-router'

/**
 * `/invite/:token` — S-0.1 action 3, a claimable single-use invite link.
 *
 * The route's whole job is to hand the reference to the login screen's invite
 * claim, so an invitee arriving from any channel lands in one place with the
 * code already filled in. The claim itself is a server decision
 * (`auth.invite-claim.impl.server`), so this file contains no claim logic.
 */
export const Route = createFileRoute('/_auth/invite/$token')({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === 'string' ? search.code : undefined,
  }),
  loader: ({ params, navigate }) => {
    throw navigate({
      to: '/login',
      search: { invite: params.token, error: undefined, redirectTo: undefined },
      replace: true,
    })
  },
})
