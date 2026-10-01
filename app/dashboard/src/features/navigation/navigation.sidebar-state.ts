/**
 * Server function for the sidebar's layout preference (S-A.1 · Layout
 * persistence).
 *
 * A route module is compiled for the client as well as the server, so it cannot
 * import `@tanstack/react-start/server` (nor a `*.server.*` module) directly —
 * TanStack Start's import-protection plugin denies both at build time. The
 * server function is the sanctioned way across that boundary: the same shape
 * `getWorkspaceContext` uses, and the one `beforeLoad` already calls.
 *
 * The parsing lives in `navigation.sidebar-preference.ts`, which is pure and
 * unit-tested; this module only supplies the request.
 */
import { createServerFn } from '@tanstack/react-start'
import { readSidebarOpen } from './navigation.sidebar-preference'

/**
 * The rail's collapsed/expanded state for this render, from the `sidebar_state`
 * cookie. `undefined` means "no opinion" — a first visit, or a value written by
 * something else — and the shell renders the rail open.
 */
export const getSidebarOpenState = createServerFn({ method: 'GET' }).handler(
  async (): Promise<boolean | undefined> => {
    const { getRequest } = await import('@tanstack/react-start/server')
    return readSidebarOpen(getRequest().headers.get('cookie'))
  },
)
