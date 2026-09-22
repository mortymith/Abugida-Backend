import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { PlusSignIcon } from '@hugeicons/core-free-icons'
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
import { RetryErrorState } from '#/components/common/retry-error-state'
import { rolesQueryOptions } from '../hooks/settings.queries'
import { useCreateCustomRole, useSaveRolePermissions } from '../hooks/settings.mutations'
import { PermissionMatrix } from './settings.permission-matrix'

/**
 * S-6.9 Roles & Permissions — the per-module capability matrix (spec 09
 * shared component #16) with built-in role locks, custom-role cloning, and
 * the zero-manager conflict warning.
 */

export function RolesView() {
  const query = useQuery(rolesQueryOptions())
  const save = useSaveRolePermissions()
  const createRole = useCreateCustomRole()

  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string[]> | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (query.isError) {
    return <RetryErrorState onRetry={() => void query.refetch()} isRetrying={query.isFetching} />
  }

  const data = query.data
  const fallbackRole = data.roles[0] as (typeof data.roles)[number] | undefined
  const activeRole =
    data.roles.find((role) => role.name === (selectedRole ?? fallbackRole?.name)) ?? fallbackRole
  const isAdminRole = activeRole?.name === 'admin'
  const emptyMatrix: Record<string, string[]> = {}
  const matrix = draft ?? activeRole?.permissions ?? emptyMatrix
  const dirty =
    draft != null &&
    JSON.stringify(draft) !== JSON.stringify(activeRole ? activeRole.permissions : emptyMatrix)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Roles & Permissions</h1>
          <p className="text-muted-foreground text-sm">
            Fine-grained capability toggles per module. Changes apply immediately to users with the
            role.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} /> Create Custom Role
        </Button>
      </header>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>
            Role:{' '}
            <select
              aria-label="Select role"
              className="ml-1 h-8 rounded-md border bg-background px-2 text-sm"
              value={activeRole ? activeRole.name : 'admin'}
              onChange={(event) => {
                setSelectedRole(event.target.value)
                setDraft(null)
              }}
            >
              {data.roles.map((role) => (
                <option key={role.publicId} value={role.name}>
                  {role.name}
                  {role.isBuiltIn ? '' : ' (custom)'}
                </option>
              ))}
            </select>
          </CardTitle>
          <div className="flex items-center gap-3">
            {dirty ? <span className="text-muted-foreground text-xs">Unsaved changes</span> : null}
            <Button
              size="sm"
              disabled={!dirty || save.isPending}
              onClick={() => {
                if (!activeRole) return
                save.mutate(
                  { roleName: activeRole.name, permissions: matrix },
                  { onSuccess: () => setDraft(null) },
                )
              }}
            >
              {save.isPending ? 'Saving…' : 'Save Permissions'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeRole?.isBuiltIn === true && isAdminRole ? (
            <p className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
              The Admin role's core permissions are locked: write access to every module must remain
              so the workspace can never be locked out.
            </p>
          ) : null}
          {activeRole != null ? (
            <PermissionMatrix
              modules={data.modules}
              capabilities={data.capabilities}
              matrix={matrix}
              memberCount={data.roleMemberCounts[activeRole.name] ?? 0}
              lockWrite={isAdminRole}
              onChange={(moduleName, capability, checked) => {
                const current = matrix[moduleName] ?? []
                const next = checked
                  ? [...current, capability]
                  : current.filter((cap) => cap !== capability)
                setDraft({ ...matrix, [moduleName]: next })
              }}
            />
          ) : null}
          {save.isError ? (
            <p className="text-destructive text-sm" role="alert">
              {save.error instanceof Error
                ? save.error.message.replace(/^[A-Z_]+:\s*/, '')
                : 'Unable to save permissions. Retry?'}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Custom Role</DialogTitle>
            <DialogDescription>
              Clones the selected role's matrix; you can tune each capability afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-role-name">Role name</Label>
              <Input
                id="new-role-name"
                value={newRoleName}
                onChange={(event) => setNewRoleName(event.target.value.toLowerCase())}
                placeholder="e.g. content-manager"
              />
              <p className="text-muted-foreground text-xs">
                Lowercase letters, numbers, dashes. Members receive this role from Team Management.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clone-source">Clone from</Label>
              <select
                id="clone-source"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                defaultValue="editor"
              >
                {data.roles.map((role) => (
                  <option key={role.publicId} value={role.name}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={newRoleName.trim().length < 2 || createRole.isPending}
              onClick={async () => {
                const source = (document.getElementById('clone-source') as HTMLSelectElement).value
                try {
                  await createRole.mutateAsync({ roleName: newRoleName.trim(), cloneFrom: source })
                  setCreateOpen(false)
                  setNewRoleName('')
                  setSelectedRole(newRoleName.trim())
                } catch {
                  /* toast handled by mutation */
                }
              }}
            >
              {createRole.isPending ? 'Creating…' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-muted-foreground text-xs">
        Custom roles start from the cloned matrix; built-in roles inherit the spec 11 defaults until
        customized. Members holding each role:{' '}
        {data.roles
          .map((role) => `${role.name}: ${data.roleMemberCounts[role.name] ?? 0}`)
          .join(' · ')}
        .
      </p>
    </div>
  )
}
