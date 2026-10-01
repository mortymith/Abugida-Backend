import { useEffect, useRef, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { getVisibleNavItems, useBreadcrumbs } from '#/features/navigation'
import { useWorkspaceRole } from '#/features/workspaces'
import {
  buildDocumentTitle,
  composeAnnouncement,
} from '#/features/navigation/navigation.page-title'

/**
 * Cross-screen contract, implemented once for every authenticated screen: a
 * client-side navigation **announces the new route** in a polite live region and
 * **moves focus into the content region**, so a keyboard or screen-reader user is
 * not left at the top of a page they have already left.
 *
 * Details that are easy to get wrong:
 *
 * - **The first render is skipped.** Moving focus during hydration would fight
 *   the browser and desynchronise SSR.
 * * **Focus is not stolen while the user is working.** If focus is already inside
 *   the content region — mid-form, or with a dialog open — only the announcement
 *   happens.
 * - The 403/404 states rendered inside the shell take focus instead, because they
 *   *are* the screen; the shell chrome does not.
 * - **The announcement is a title, not a URL.** The breadcrumb trail already
 *   carries the human labels the route guard built (`SEGMENT_LABELS`), so
 *   `/courses/abc123` is announced as "Courses / Course 3" rather than as a path
 *   nobody says out loud. The same composition titles the document, so the tab,
 *   the window switcher and the palette entry all agree.
 */
export function RouteAnnouncer() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const role = useWorkspaceRole()
  const canSeeCourses = getVisibleNavItems(role).some((item) => item.id === 'courses')
  const crumbs = useBreadcrumbs({ canSeeCourses })
  const previousPath = useRef<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const labels = crumbs.map((crumb) => crumb.label)
  const spoken = composeAnnouncement(labels)

  // The document title is set on **every** render pass, including the first: SSR
  // renders the same title, so hydration cannot disagree. On the client the title
  // is a pure function of where you are, which is exactly what a tab switcher
  // needs to be useful.
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.title = buildDocumentTitle(labels)
  }, [spoken])

  useEffect(() => {
    if (previousPath.current === pathname) return
    const isFirstRender = previousPath.current === null
    previousPath.current = pathname
    if (isFirstRender) return

    setAnnouncement(spoken)
    const insideContent = document.activeElement?.closest('[data-route-content]')
    if (insideContent) return
    document.querySelector<HTMLElement>('[data-route-content]')?.focus()
  }, [pathname, spoken])

  return (
    <p aria-live="polite" className="sr-only">
      {announcement}
    </p>
  )
}
