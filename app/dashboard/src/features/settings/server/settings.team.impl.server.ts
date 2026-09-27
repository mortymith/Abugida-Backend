/**
 * Server-only implementation of S-6.2 Team Management. Reads come from the
 * Better Auth organization tables (member/invitation joined to users);
 * mutations go through the Better Auth organization plugin API so invitation
 * tokens, role validation, and events stay in one place. Never import from
 * client code.
 */
import { and, asc, eq, inArray, sql } from '@abugida/database'
import { member, invitation, users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import { auth } from '#/config/auth.server'
import { getRequest } from '@tanstack/react-start/server'
import {
  requireSettingsAdmin,
  resolveCallerOrganization,
  writeAudit,
} from './settings.server-helpers.server'
import { mapBetterAuthRoleToPlatformRole } from '#/features/auth/auth.roles'
import type { TeamInvitationItem, TeamMemberItem, TeamPage } from '../settings.types'
import type {
  InviteTeamMemberInput,
  RemoveTeamMemberInput,
  UpdateTeamMemberRoleInput,
} from '../schemas/settings.schema'

async function callOrganizationApi<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const request = getRequest()
  const result = await (
    auth.raw.api as unknown as Record<
      string,
      (args: { headers: Headers; body: Record<string, unknown> }) => Promise<T>
    >
  )[endpoint]({ headers: request.headers, body })
  return result
}

export async function getTeamPageImpl(): Promise<TeamPage> {
  const adminId = await requireSettingsAdmin()
  const org = await resolveCallerOrganization(adminId)
  if (!org) {
    return { members: [], invitations: [], availability: 'no_data' }
  }

  const memberRows = await db
    .select({
      memberId: member.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: member.role,
      accountStatus: sql<string>`${users.accountStatus}::text`,
      deletedAt: users.deletedAt,
      joinedAt: member.createdAt,
    })
    .from(member)
    .innerJoin(users, eq(users.id, member.userId))
    .where(eq(member.organizationId, org.id))
    .orderBy(asc(member.createdAt))

  const members: TeamMemberItem[] = memberRows.map((row) => ({
    memberId: row.memberId,
    userId: row.userId,
    name: row.name ?? 'Unnamed',
    email: row.email ?? '',
    role: mapBetterAuthRoleToPlatformRole(row.role),
    // Inactive = suspended/locked/deleted account (spec status column).
    status:
      !row.deletedAt &&
      (row.accountStatus === 'active' || row.accountStatus === 'pending_verification')
        ? 'active'
        : 'inactive',
    joinedAt: row.joinedAt.toISOString(),
    isCurrentUser: row.userId === adminId,
  }))

  const pendingInvitations = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      inviterId: invitation.inviterId,
    })
    .from(invitation)
    .where(and(eq(invitation.organizationId, org.id), eq(invitation.status, 'pending')))

  const inviterIds = [...new Set(pendingInvitations.map((row) => row.inviterId))]
  const inviters = inviterIds.length
    ? await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, inviterIds))
    : []
  const inviterNames = new Map(
    inviters.map((user) => [user.id, user.name ?? user.email ?? 'A team admin']),
  )

  const invitations: TeamInvitationItem[] = pendingInvitations.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role ? mapBetterAuthRoleToPlatformRole(row.role) : null,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    inviterName: inviterNames.get(row.inviterId) ?? null,
  }))

  return { members, invitations, availability: members.length === 0 ? 'no_data' : 'ok' }
}

export async function inviteTeamMemberImpl(input: InviteTeamMemberInput): Promise<{ ok: true }> {
  const adminId = await requireSettingsAdmin()
  const org = await resolveCallerOrganization(adminId)
  if (!org) throw new Error('NO_ORGANIZATION')

  await callOrganizationApi('inviteMember', {
    email: input.email,
    role: input.role,
    organizationId: org.id,
    // Keep invitees out of the member list until they accept.
    resend: true,
  })

  await writeAudit({
    actorId: adminId,
    action: 'admin_action',
    resourceType: 'user_account',
    metadata: {
      screen: 'S-6.2',
      action: 'invite_team_member',
      email: input.email,
      role: input.role,
    },
  })
  return { ok: true }
}

export async function updateTeamMemberRoleImpl(
  input: UpdateTeamMemberRoleInput,
): Promise<{ ok: true }> {
  const adminId = await requireSettingsAdmin()
  const org = await resolveCallerOrganization(adminId)
  if (!org) throw new Error('NO_ORGANIZATION')

  // Lockout guard: a demotion may not remove the org's last admin/owner.
  const target = await db
    .select({ id: member.id, role: member.role })
    .from(member)
    .where(and(eq(member.id, input.memberId), eq(member.organizationId, org.id)))
    .limit(1)
  const current = target.at(0)
  if (!current) throw new Error('MEMBER_NOT_FOUND')
  const demoting =
    mapBetterAuthRoleToPlatformRole(current.role) === 'admin' && input.role !== 'admin'
  if (demoting) {
    const { hasOtherAdmin } = await import('./settings.server-helpers.server')
    if (!(await hasOtherAdmin(org.id, input.memberId))) {
      throw new Error('LAST_ADMIN: A workspace needs at least one Admin.')
    }
  }

  await callOrganizationApi('updateMemberRole', {
    memberId: input.memberId,
    role: input.role,
  })

  await writeAudit({
    actorId: adminId,
    action: 'permission_change',
    resourceType: 'role_assignment',
    metadata: {
      screen: 'S-6.2',
      action: 'update_member_role',
      memberId: input.memberId,
      role: input.role,
    },
  })
  return { ok: true }
}

export async function removeTeamMemberImpl(input: RemoveTeamMemberInput): Promise<{ ok: true }> {
  const adminId = await requireSettingsAdmin()
  const org = await resolveCallerOrganization(adminId)
  if (!org) throw new Error('NO_ORGANIZATION')

  // Lockout guard: may not remove the org's last admin/owner.
  const target = await db
    .select({ id: member.id, role: member.role })
    .from(member)
    .where(and(eq(member.id, input.memberId), eq(member.organizationId, org.id)))
    .limit(1)
  const current = target.at(0)
  if (!current) throw new Error('MEMBER_NOT_FOUND')
  if (mapBetterAuthRoleToPlatformRole(current.role) === 'admin') {
    const { hasOtherAdmin } = await import('./settings.server-helpers.server')
    if (!(await hasOtherAdmin(org.id, input.memberId))) {
      throw new Error('LAST_ADMIN: A workspace needs at least one Admin.')
    }
  }

  await callOrganizationApi('removeMember', {
    memberIdOrEmail: input.memberId,
    organizationId: org.id,
  })

  await writeAudit({
    actorId: adminId,
    action: 'permission_change',
    resourceType: 'role_assignment',
    metadata: { screen: 'S-6.2', action: 'remove_member', memberId: input.memberId },
  })
  return { ok: true }
}

export async function cancelTeamInvitationImpl(input: {
  invitationId: string
}): Promise<{ ok: true }> {
  const adminId = await requireSettingsAdmin()
  const org = await resolveCallerOrganization(adminId)
  if (!org) throw new Error('NO_ORGANIZATION')

  // Ensure the invitation belongs to the caller's org before cancelling.
  const rows = await db
    .select({ id: invitation.id })
    .from(invitation)
    .where(and(eq(invitation.id, input.invitationId), eq(invitation.organizationId, org.id)))
    .limit(1)
  if (!rows.at(0)) throw new Error('INVITATION_NOT_FOUND')

  await callOrganizationApi('cancelInvitation', { invitationId: input.invitationId })

  await writeAudit({
    actorId: adminId,
    action: 'admin_action',
    resourceType: 'user_account',
    metadata: { screen: 'S-6.2', action: 'cancel_invitation', invitationId: input.invitationId },
  })
  return { ok: true }
}

/** Exported for the roles screen: verify org context exists before matrix edits. */
export async function assertOrganizationExists(): Promise<string> {
  const adminId = await requireSettingsAdmin()
  const org = await resolveCallerOrganization(adminId)
  if (!org) throw new Error('NO_ORGANIZATION')
  return org.id
}
