import { Fragment } from 'react'
import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ChevronDownIcon } from '@hugeicons/core-free-icons'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '#/components/ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { getVisibleNavItems, useBreadcrumbs } from '#/features/navigation'
import { useWorkspaceRole } from '#/features/workspaces'
import { cn } from '#/lib/utils'

/**
 * S-A.1 breadcrumbs.
 *
 * An `<ol>` (ordered list) with `aria-current="page"` on the last crumb;
 * intermediate crumbs are links, the last is text (spec 11 keyboard baseline).
 *
 * Two spec details are structural:
 *
 * - **Ge'ez-safe truncation.** The course and item segments truncate with
 *   single-line `text-overflow: ellipsis`, never a fixed-px clamp and never a
 *   middle-ellipsis string, and the **full** value rides on both `title` and
 *   `aria-label` so truncation is purely visual. Segments are never constrained
 *   below 40 characters of growth headroom, because Ge'ez is shorter in
 *   characters and wider in glyphs.
 * - **The tab segment is a disclosure, not a link.** It is a `button` with
 *   `aria-expanded` listing the five workspace destinations, which makes
 *   switching tabs reachable without scrolling back to the workspace header.
 */
export function AppBreadcrumbs() {
  const role = useWorkspaceRole()
  const canSeeCourses = getVisibleNavItems(role).some((item) => item.id === 'courses')
  const crumbs = useBreadcrumbs({ canSeeCourses })

  if (crumbs.length === 0) return null

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList>
        {crumbs.map((crumb, index) => (
          <Fragment key={crumb.key}>
            <BreadcrumbItem className="min-w-0">
              <Crumb crumb={crumb} isLast={index === crumbs.length - 1} />
            </BreadcrumbItem>
            {index < crumbs.length - 1 ? <BreadcrumbSeparator /> : null}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

/**
 * `aria-current="page"` belongs to the **last** crumb only. The workspace trail
 * marks both the tab and a selected item as current context, so the renderer —
 * not the data — decides which one is the page.
 */
function Crumb({
  crumb,
  isLast,
}: {
  crumb: ReturnType<typeof useBreadcrumbs>[number]
  isLast: boolean
}) {
  if (crumb.tabs) {
    return (
      <span className="flex min-w-0 items-center gap-1">
        {/*
          The current crumb is **text**, not a link. Truncation is CSS-only, so
          the text content — and therefore the accessible name — is the full
          value; `title` gives the same value on hover.
        */}
        <span
          aria-current={isLast ? 'page' : undefined}
          title={crumb.fullLabel}
          className="min-w-0 max-w-[40ch] truncate font-normal text-foreground"
        >
          {crumb.label}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={`Switch ${crumb.label} tab`}
                className="rounded p-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            }
          >
            <HugeiconsIcon icon={ChevronDownIcon} strokeWidth={2} className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {crumb.tabs.map((tab) => (
              <DropdownMenuItem
                key={tab.to}
                nativeButton={false}
                render={<Link to={tab.to} />}
                aria-current={tab.isActive ? 'page' : undefined}
                className={cn(tab.isActive && 'font-medium')}
              >
                {tab.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    )
  }

  if (crumb.isCurrent) {
    return (
      <span
        aria-current={isLast ? 'page' : undefined}
        title={crumb.fullLabel}
        className="min-w-0 max-w-[40ch] truncate font-normal text-foreground"
      >
        {crumb.label}
      </span>
    )
  }

  return (
    <BreadcrumbLink
      render={<Link to={crumb.to ?? '/dashboard'} />}
      title={crumb.fullLabel}
      // The link's accessible name is the **full** title, so truncation is
      // purely visual.
      aria-label={crumb.fullLabel}
      className="min-w-0 max-w-[40ch] truncate"
    >
      {crumb.label}
    </BreadcrumbLink>
  )
}
