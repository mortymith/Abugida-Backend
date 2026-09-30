import { createFileRoute } from '@tanstack/react-router'

import { MfaChallenge } from '#/features/auth/components/auth.mfa-challenge'

/**
 * S-0.3 Multi-Factor Authentication Challenge.
 *
 * Route files stay thin — every state (lock, countdown, recovery path) is
 * derived server-side by the feature component.
 */
export const Route = createFileRoute('/_auth/mfa')({
  component: MfaChallenge,
})
