/**
 * Spec 13 S-13.1 Workspace Configuration server functions. The heavy lifting
 * lives in `settings.workspace-config.impl.server.ts`; the impl is imported
 * inside the handler so this module stays safe for the client bundle.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { WorkspaceConfigResult } from '../settings.workspace-policies'
import type { WorkspacePolicies } from '@abugida/database/auth'

export const getWorkspaceConfig = createServerFn({ method: 'GET' }).handler(
  async (): Promise<WorkspaceConfigResult> => {
    const { getWorkspaceConfigImpl } = await import('./settings.workspace-config.impl.server')
    return getWorkspaceConfigImpl()
  },
)

const saveWorkspaceConfigSchema = z.object({
  policies: z
    .object({
      membershipLimit: z.number().int().min(1).max(500).nullable(),
      invitationLimit: z.number().int().min(0).max(200).nullable(),
      invitationExpiresInDays: z.number().int().min(1).max(30).nullable(),
      organizationLimit: z.number().int().min(1).max(20).nullable(),
      cancelPendingInvitationsOnReInvite: z.boolean().nullable(),
      allowUserToCreateOrganization: z.boolean().nullable(),
      requireMfaFor: z.enum(['everyone', 'editors+reviewers', 'no_one']).nullable(),
      sessionTimeoutMinutes: z.number().int().nullable(),
      sessionRevocationOnRoleChange: z.boolean().nullable(),
    })
    .partial(),
})

export type SaveWorkspaceConfigInput = z.infer<typeof saveWorkspaceConfigSchema>

export const saveWorkspaceConfig = createServerFn({ method: 'POST' })
  .validator((input: unknown) => saveWorkspaceConfigSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { saveWorkspaceConfigImpl } = await import('./settings.workspace-config.impl.server')
    return saveWorkspaceConfigImpl(data as { policies: Partial<WorkspacePolicies> })
  })
