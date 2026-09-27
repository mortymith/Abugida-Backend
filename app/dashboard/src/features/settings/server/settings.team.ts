import { createServerFn } from '@tanstack/react-start'
import type { TeamPage } from '../settings.types'
import {
  cancelInvitationSchema,
  inviteTeamMemberSchema,
  removeTeamMemberSchema,
  updateTeamMemberRoleSchema,
} from '../schemas/settings.schema'

/**
 * Client-safe S-6.2 Team Management server functions. Membership mutations
 * go through the existing Better Auth organization plugin (never manual
 * member-table writes) — see the impl module.
 */

export const getTeamPage = createServerFn({ method: 'GET' }).handler(
  async (): Promise<TeamPage> => {
    const { getTeamPageImpl } = await import('./settings.team.impl.server')
    return getTeamPageImpl()
  },
)

export const inviteTeamMember = createServerFn({ method: 'POST' })
  .validator((input: unknown) => inviteTeamMemberSchema.parse(input))
  .handler(async ({ data }) => {
    const { inviteTeamMemberImpl } = await import('./settings.team.impl.server')
    return inviteTeamMemberImpl(data)
  })

export const updateTeamMemberRole = createServerFn({ method: 'POST' })
  .validator((input: unknown) => updateTeamMemberRoleSchema.parse(input))
  .handler(async ({ data }) => {
    const { updateTeamMemberRoleImpl } = await import('./settings.team.impl.server')
    return updateTeamMemberRoleImpl(data)
  })

export const removeTeamMember = createServerFn({ method: 'POST' })
  .validator((input: unknown) => removeTeamMemberSchema.parse(input))
  .handler(async ({ data }) => {
    const { removeTeamMemberImpl } = await import('./settings.team.impl.server')
    return removeTeamMemberImpl(data)
  })

export const cancelTeamInvitation = createServerFn({ method: 'POST' })
  .validator((input: unknown) => cancelInvitationSchema.parse(input))
  .handler(async ({ data }) => {
    const { cancelTeamInvitationImpl } = await import('./settings.team.impl.server')
    return cancelTeamInvitationImpl(data)
  })
