import { HugeiconsIcon } from '@hugeicons/react'
import { Building03Icon, Logout02Icon, Settings02Icon, UserIcon } from '@hugeicons/core-free-icons'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '#/components/ui/dropdown-menu'
import { useLogout } from '#/features/auth'
import { useWorkspaceContext } from '#/features/workspaces'
import { useWorkspaceSwitcherOpen } from './layout.workspace-switcher'

/**
 * The account menu, shared by the header avatar trigger and the sidebar footer
 * block so the two can never list different items.
 *
 * Entries and their rules (S-A.1 · Avatar Menu):
 *
 * | Entry              | Rule                                                   |
 * | ------------------ | ------------------------------------------------------ |
 * | My Profile         | every role — it is the user's own record               |
 * | Settings           | `settings.write` (Admin) — **absent** for every other role |
 * | Switch workspace   | only when the user belongs to more than one workspace   |
 * | Sign out           | always                                                 |
 *
 * "Absent" is not a preference: it is the spec's permission-aware rule, so a
 * role without `settings.write` never sees a dead Settings entry.
 */
export function UserMenuContent({
  align = 'end',
  side,
  className,
}: {
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}) {
  const { logout, isLoggingOut } = useLogout()
  const workspace = useWorkspaceContext()
  const switcher = useWorkspaceSwitcherOpen()
  const canSwitch = workspace.workspaces.length > 1

  return (
    <DropdownMenuContent align={align} {...(side ? { side } : {})} className={className ?? 'w-56'}>
      <DropdownMenuItem nativeButton={false} render={<a href="/settings/profile" />}>
        <HugeiconsIcon icon={UserIcon} strokeWidth={2} />
        My Profile &amp; Account
      </DropdownMenuItem>

      {workspace.role === 'admin' ? (
        <DropdownMenuItem nativeButton={false} render={<a href="/settings" />}>
          <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />
          Settings
        </DropdownMenuItem>
      ) : null}

      {canSwitch ? (
        <DropdownMenuItem onClick={() => switcher.setOpen(true)}>
          <HugeiconsIcon icon={Building03Icon} strokeWidth={2} />
          Switch workspace
        </DropdownMenuItem>
      ) : null}

      <DropdownMenuSeparator />

      <DropdownMenuItem onClick={() => void logout()} disabled={isLoggingOut}>
        <HugeiconsIcon icon={Logout02Icon} strokeWidth={2} />
        Sign out
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}
