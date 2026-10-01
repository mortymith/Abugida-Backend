import { SidebarTrigger, useSidebar } from '#/components/ui/sidebar'
import { Separator } from '#/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { DropdownMenu, DropdownMenuTrigger } from '#/components/ui/dropdown-menu'
import { HugeiconsIcon } from '@hugeicons/react'
import { CircleQuestionMarkIcon } from '@hugeicons/core-free-icons'
import { Button } from '#/components/ui/button'
import { PRIMARY_NAV_ID } from './layout.app-sidebar'
import { AppBreadcrumbs } from './layout.breadcrumbs'
import { UserMenuContent } from './layout.user-menu'

import { CreateCourseButton, trackNavEvent } from '#/features/navigation'
import { SearchTrigger } from '#/features/search'
import { HelpPanel } from '#/features/support'
import { useSession } from '#/features/auth'
import { useState } from 'react'

/**
 * S-A.1 top header, 64px, fixed above a scrollable content region.
 *
 * Order is deliberate and matches the spec's wireframe:
 *
 * 1. **Menu** — collapses the sidebar; `Esc` in the mobile drawer returns focus
 *    here.
 * 2. **Breadcrumb** — workspace-aware, see `layout.breadcrumbs.tsx`. The active
 *    workspace name lives in the sidebar wordmark, so the header does not
 *    repeat it (S-13.2 switching stays available in the avatar menu and the
 *    mobile drawer).
 * 3. **Help · Search · New Course** — quick actions, each role-gated.
 * 4. **Avatar** — `aria-haspopup="menu"`, with **Switch workspace** present only
 *    when the user belongs to more than one workspace, the same predicate the
 *    header button uses.
 */
export function Header() {
  const { data: session } = useSession()
  const { open, openMobile, isMobile } = useSidebar()
  const [helpOpen, setHelpOpen] = useState(false)

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

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-card px-4">
      {/*
        The collapse control: a `button` with `aria-expanded` and `aria-controls`
        pointing at the navigation it controls. `Esc` in the mobile drawer closes
        it and returns focus here, which the drawer primitive handles.
      */}
      <SidebarTrigger
        className="-ml-1"
        aria-expanded={isMobile ? openMobile : open}
        aria-controls={PRIMARY_NAV_ID}
        onClick={() =>
          trackNavEvent('nav.sidebar_toggled', {
            state: isMobile ? !openMobile : !open ? 'collapsed' : 'expanded',
          })
        }
      />
      <Separator orientation="vertical" className="mr-2 h-4" />

      <AppBreadcrumbs />

      <div className="flex-1" />

      {/* S-7.4: help entry point available on every screen (S-A.1). */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setHelpOpen(true)}
        aria-label="Open Help and Support"
      >
        <HugeiconsIcon icon={CircleQuestionMarkIcon} strokeWidth={2} />
      </Button>
      <HelpPanel open={helpOpen} onOpenChange={setHelpOpen} />

      <SearchTrigger />

      {/* Quick-create. `course.create`: absent for roles without it, never
          disabled — the button owns that rule. */}
      <CreateCourseButton />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={user?.name ? `Account menu for ${user.name}` : 'Account menu'}
              className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          }
        >
          <Avatar size="sm">
            {userImage != null ? <AvatarImage src={userImage} alt="" /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <UserMenuContent align="end" />
      </DropdownMenu>
    </header>
  )
}
