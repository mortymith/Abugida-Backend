import { SidebarTrigger } from '#/components/ui/sidebar'
import { Separator } from '#/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { HugeiconsIcon } from '@hugeicons/react'
import { UserIcon, Settings02Icon, Logout02Icon } from '@hugeicons/core-free-icons'
import { AppBreadcrumbs } from './layout.breadcrumbs'
import { CreateCourseButton } from '#/features/navigation'
import { SearchTrigger } from '#/features/search'
import { useLogout, useSession } from '#/features/auth'

export function Header() {
  const { data: session } = useSession()
  const { logout, isLoggingOut } = useLogout()
  const user = session?.user

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??'

  const userImage = user?.image ?? undefined

  function handleLogout() {
    void logout()
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <AppBreadcrumbs />

      <div className="flex-1" />

      <SearchTrigger />
      <CreateCourseButton />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar size="sm">
                {userImage != null && <AvatarImage src={userImage} alt={user?.name ?? ''} />}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </button>
          }
        />
        <DropdownMenuContent align="end" className="w-56">
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
    </header>
  )
}
