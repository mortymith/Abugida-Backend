import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '#/components/ui/sidebar'
import { DropdownMenu, DropdownMenuTrigger } from '#/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { UserMenuContent } from './layout.user-menu'
import { useSession } from '#/features/auth'

/**
 * S-A.1 sidebar footer: the signed-in user, with the same account menu the
 * header avatar opens (one implementation, so the two cannot disagree about
 * which entries a role has).
 *
 * The name is always rendered — including in the 64px collapsed rail, where the
 * avatar alone would leave the control unnamed.
 */
export function SidebarUserSection() {
  const { data: session } = useSession()
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

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton aria-label={`Account menu for ${user?.name ?? 'user'}`} />}
          >
            <Avatar size="sm">
              {userImage != null ? <AvatarImage src={userImage} alt="" /> : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{user?.name ?? 'User'}</span>
          </DropdownMenuTrigger>
          <UserMenuContent side="top" align="start" />
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
