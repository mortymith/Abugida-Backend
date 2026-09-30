/**
 * S-0.2 sign-up server functions.
 *
 * Kept out of `src/server/functions/` (the legacy app-wide folder) so the
 * wizard's server contract lives with the auth feature, in the
 * wrapper/impl pair the AGENTS.md server-boundary rule requires.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

/** S-0.2 Primary Use Case. See `onboarding.checklist.ts` for what it controls. */
export const SignupWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Workspace name must be at least 2 characters')
    .max(80, 'Workspace name must be 80 characters or fewer'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Subdomain must be at least 3 characters')
    .max(63, 'Subdomain must be at most 63 characters')
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
      'Subdomain can only contain lowercase letters, numbers, and hyphens',
    ),
  useCase: z.enum(['sell_courses', 'run_courses', 'train_employees'], {
    error: 'Select a primary use case to continue.',
  }),
})

export type SignupWorkspaceInput = z.infer<typeof SignupWorkspaceSchema>

/** A domain that is free to claim, so the wizard can skip the round-trip. */
export const getSignupProviders = createServerFn({ method: 'GET' }).handler(async () => {
  const { configuredProviders } = await import('./auth.signin.impl.server')
  return configuredProviders()
})

export const checkSubdomainAvailable = createServerFn({ method: 'POST' })
  .validator((input: { slug: string }) => input)
  .handler(async ({ data }): Promise<{ available: boolean }> => {
    const { checkSubdomainAvailableImpl } = await import('./auth.signup.impl.server')
    return checkSubdomainAvailableImpl(data)
  })

export type ProvisionResult =
  | { status: 'created'; organizationId: string; organizationName: string; slug: string }
  | { status: 'slug_taken'; suggestions: string[] }
  | { status: 'unauthenticated' }
  | { status: 'workspace_limit'; existingWorkspaceName: string | null }
  | { status: 'server_error'; requestId: string }

/**
 * Create the workspace and make the caller its first Admin. A failure never
 * leaves a half-created `organizations` row: the call is a single Better Auth
 * transaction, and a taken subdomain is reported as a field error so the rest of
 * step 1 survives.
 */
export const provisionWorkspace = createServerFn({ method: 'POST' })
  .validator(SignupWorkspaceSchema)
  .handler(async ({ data }): Promise<ProvisionResult> => {
    const { provisionWorkspaceImpl } = await import('./auth.signup.impl.server')
    return provisionWorkspaceImpl(data)
  })

/** Resolve an invitation reference to the workspace it points at (or `null`). */
export const lookupInviteWorkspace = createServerFn({ method: 'GET' })
  .validator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const { lookupInviteWorkspaceImpl } = await import('./auth.signup.impl.server')
    return lookupInviteWorkspaceImpl(data)
  })
