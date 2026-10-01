import { useEffect, useRef, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'

/**
 * Part 00 cross-screen contract, implemented once for every authenticated
 * screen: a client-side navigation **announces the new route** in a polite live
 * region and **moves focus into the content region**, so a keyboard or
 * screen-reader user is not left at the top of a page they have already left.
 *
 * Details that are easy to get wrong:
 *
 * - **The first render is skipped.** Moving focus during hydration would fight
 *   the browser and desynchronise SSR.
 * - **Focus is not stolen while the user is working.** If focus is already inside
 *   the content region — mid-form, or with a dialog open — only the announcement
 *   happens.
 * - The 403/404 states rendered inside the shell take focus instead, because
 *   they *are* the screen; the shell chrome does not.
 */
export function RouteAnnouncer() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const previousPath = useRef<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (previousPath.current === pathname) return
    const isFirstRender = previousPath.current === null
    previousPath.current = pathname
    if (isFirstRender) return

    setAnnouncement(pathname)
    const insideContent = document.activeElement?.closest('[data-route-content]')
    if (insideContent) return
    document.querySelector<HTMLElement>('[data-route-content]')?.focus()
  }, [pathname])

  return (
    <p aria-live="polite" className="sr-only">
      {announcement}
    </p>
  )
}
