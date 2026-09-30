import { createFileRoute } from '@tanstack/react-router'

import { MfaEnrollment } from '#/features/auth/components/auth.mfa-enrollment'

/**
 * S-0.4 Multi-Factor Enrollment.
 *
 * Reachable from Settings → My Profile, from the Security policy prompt, and
 * from a support recovery window. Reachable by every signed-in role — the
 * server decides whether a workspace policy replaces the surface with an
 * explanation, rather than the route hiding it.
 */
export const Route = createFileRoute('/_app/settings/mfa')({
  component: MfaEnrollment,
})
