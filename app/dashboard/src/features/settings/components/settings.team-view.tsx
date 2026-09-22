import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { PlusSignIcon, Delete02Icon, CancelIcon } from '@hugeicons/core-free-icons'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Badge } from '#/components/ui/badge'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { teamQueryOptions } from '../hooks/settings.queries'
import {
  useCancelTeamInvitation,
  useInviteTeamMember,
  useRemoveTeamMember,
  useUpdateTeamMemberRole,
} from '../hooks/settings.mutations'
import { PLATFORM_ROLES } from '#/features/auth/auth.roles'
import { ROLE_DEFINITIONS } from '../settings.constants'
import type { TeamMemberItem } from '../settings.types'

/**
 * S-6.2 Team Management — members, roles, statuses, invitations, and the
 * role definitions block (admin only). Invites open a modal with email and
 * role selection; edits go through role dropdowns; removal is confirmed.
 */

function statusBadge(status: TeamMemberItem['status']) {
  return status === 'active' ? (
    <Badge className="bg-success/15 text-success">Active</Badge>
  ) : (
    <Badge variant="secondary">Inactive</Badge>
  )
}

export function TeamView() {
  const teamQuery = useQuery(teamQueryOptions())
  const invite = useInviteTeamMember()
  const updateRole = useUpdateTeamMemberRole()
  const removeMember = useRemoveTeamMember()
  const cancelInvite = useCancelTeamInvitation()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<(typeof PLATFORM_ROLES)[number]>('viewer')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [memberToRemove, setMemberToRemove] = useState<TeamMemberItem | null>(null)

  if (teamQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (teamQuery.isError) {
    return (
      <RetryErrorState onRetry={() => void teamQuery.refetch()} isRetrying={teamQuery.isFetching} />
    )
  }

  const data = teamQuery.data

  async function handleInvite() {
    setInviteError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      setInviteError('Enter a valid email address.')
      return
    }
    try {
      await invite.mutateAsync({ email: inviteEmail, role: inviteRole })
      setInviteOpen(false)
      setInviteEmail('')
      setInviteRole('viewer')
    } catch (cause) {
      setInviteError(
        cause instanceof Error
          ? cause.message.replace(/^[A-Z_]+:\s*/, '')
          : 'Unable to send invitation. Retry?',
      )
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Team</h1>
          <p className="text-muted-foreground text-sm">
            Manage team members, their roles, and access levels.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} /> Invite Team Member
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {data.members.length === 0 ? (
            <EmptyState
              title="No team members added yet."
              description="Invite your first team member."
              action={<Button onClick={() => setInviteOpen(true)}>Invite Team Member</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.members.map((member) => (
                    <TableRow key={member.memberId}>
                      <TableCell className="font-medium">
                        {member.name}
                        {member.isCurrentUser ? (
                          <span className="text-muted-foreground"> (you)</span>
                        ) : null}
                      </TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        {member.role === 'admin' && member.isCurrentUser ? (
                          <span>{member.role}</span>
                        ) : (
                          <select
                            aria-label={`Role for ${member.name}`}
                            className="h-8 rounded-md border bg-background px-2 text-sm"
                            value={member.role}
                            disabled={
                              member.role === 'admin' &&
                              data.members.filter((m) => m.role === 'admin').length === 1
                            }
                            title={
                              member.role === 'admin' &&
                              data.members.filter((m) => m.role === 'admin').length === 1
                                ? 'A workspace needs at least one Admin'
                                : undefined
                            }
                            onChange={(event) =>
                              updateRole.mutate({
                                memberId: member.memberId,
                                role: event.target.value as (typeof PLATFORM_ROLES)[number],
                              })
                            }
                          >
                            {PLATFORM_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        )}
                      </TableCell>
                      <TableCell>{statusBadge(member.status)}</TableCell>
                      <TableCell className="text-right">
                        {!member.isCurrentUser ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${member.name}`}
                            onClick={() => setMemberToRemove(member)}
                          >
                            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {data.invitations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Invited by</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>{invitation.email}</TableCell>
                      <TableCell>{invitation.role ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{invitation.status}</Badge>
                      </TableCell>
                      <TableCell>{invitation.inviterName ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Cancel invitation for ${invitation.email}`}
                          onClick={() => cancelInvite.mutate({ invitationId: invitation.id })}
                        >
                          <HugeiconsIcon icon={CancelIcon} strokeWidth={2} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Role Definitions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Role</TableHead>
                <TableHead>Access</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROLE_DEFINITIONS.map((definition) => (
                <TableRow key={definition.role}>
                  <TableCell className="font-medium">{definition.role}</TableCell>
                  <TableCell>{definition.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              They receive an email invitation to join this workspace with the selected role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="jane@abugida.com"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={inviteRole}
                onChange={(event) =>
                  setInviteRole(event.target.value as (typeof PLATFORM_ROLES)[number])
                }
              >
                {PLATFORM_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            {inviteError ? (
              <p className="text-destructive text-sm" role="alert">
                {inviteError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleInvite()} disabled={invite.isPending}>
              {invite.isPending ? 'Sending…' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={memberToRemove != null}
        onOpenChange={(open) => {
          if (!open) setMemberToRemove(null)
        }}
        title={`Remove ${memberToRemove?.name ?? ''} from the team?`}
        body="They lose access to this workspace immediately. Their student-facing records are unaffected."
        confirmLabel="Remove Member"
        onConfirm={async () => {
          if (!memberToRemove) return
          await removeMember.mutateAsync({ memberId: memberToRemove.memberId })
          setMemberToRemove(null)
        }}
      />
    </div>
  )
}
