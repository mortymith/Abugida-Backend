import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '#/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { HugeiconsIcon } from '@hugeicons/react'
import { UserIcon, Settings02Icon, Logout02Icon } from '@hugeicons/core-free-icons'
import { useLogout, useSession } from '#/features/auth'

export function SidebarUserSection() {
  const { data: session } = useSession()
  const { logout, isLoggingOut } = useLogout()
  const user = session?.user
  const userImage = user?.image ?? undefined

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??'

  function handleLogout() {
    void logout()
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton />}>
            <Avatar size="sm">
              {userImage != null && <AvatarImage src={userImage} alt={user?.name ?? ''} />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{user?.name ?? 'User'}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem render={<a href="/settings/profile" />}>
              <HugeiconsIcon icon={UserIcon} strokeWidth={2} />
              My Profile & Account
            </DropdownMenuItem>
            <DropdownMenuItem render={<a href="/settings" />}>
              <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
              <HugeiconsIcon icon={Logout02Icon} strokeWidth={2} />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
