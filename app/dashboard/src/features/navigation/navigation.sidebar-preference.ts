/**
 * Sidebar collapse preference (S-A.1 · Layout persistence).
 *
 * The sidebar primitive writes `sidebar_state` whenever the rail collapses, so
 * the preference already survives a reload — but only in the browser. Without
 * reading it on the server, every SSR'd page renders the wide rail first and
 * then snaps to the collapsed one after hydration: a visible flash for anyone who
 * chose to collapse it, on every single page.
 *
 * This module owns the parsing half, kept pure so the cookie handling is a
 * contract test rather than something only observable in a browser. The write
 * half stays in `components/ui/sidebar.tsx`, next to the state it belongs to.
 */

/** Must match `SIDEBAR_COOKIE_NAME` in `components/ui/sidebar.tsx`. */
export const SIDEBAR_STATE_COOKIE = 'sidebar_state'

/** `undefined` means "no opinion" — the caller falls back to open. */
export function readSidebarOpen(cookieHeader: string | null | undefined): boolean | undefined {
  if (!cookieHeader) return undefined

  const match = cookieHeader
    .split(';')
    .map((pair) => pair.trim())
    .find((pair) => pair.startsWith(`${SIDEBAR_STATE_COOKIE}=`))

  // Absent, or a value written by something else: the rail opens, as it does for
  // a first-time visitor.
  if (!match) return undefined

  const value = match.slice(SIDEBAR_STATE_COOKIE.length + 1)
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}
