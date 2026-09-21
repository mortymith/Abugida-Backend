import { Link, useRouterState } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import type { NavItem } from '#/features/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '#/components/ui/sidebar'
import { Logo } from '#/components/common/logo'
import { SidebarUserSection } from './layout.sidebar-user-section'
import { getVisibleNavItems } from '#/features/navigation'
import { useSession } from '#/features/auth'

export function AppSidebar() {
  const { data: session } = useSession()
  const userRole = (session?.user as Record<string, unknown> | undefined)?.role ?? 'viewer'
  const navItems = getVisibleNavItems(userRole as string)

  return (
    <Sidebar collapsible="icon" side="left" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/dashboard" />}>
              <Logo className="gap-2" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <NavMenuButton item={item} />
                  {item.badge != null && item.badge > 0 && (
                    <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <SidebarUserSection />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

function NavMenuButton({ item }: { item: NavItem }) {
  const routerState = useRouterState()
  const isActive =
    routerState.location.pathname === item.to ||
    routerState.location.pathname.startsWith(item.to + '/')

  return (
    <SidebarMenuButton isActive={isActive} tooltip={item.label}>
      <a href={item.to} className="flex items-center gap-2">
        <HugeiconsIcon icon={item.icon} strokeWidth={2} />
        <span>{item.label}</span>
      </a>
    </SidebarMenuButton>
  )
}
