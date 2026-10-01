/**
 * Registry of surfaces holding unsaved work.
 *
 * Spec 11 makes unsaved work a **shell-level** concern: before a session expires
 * the user is told *which* surfaces still hold a buffer, and context switching
 * flushes first rather than discarding. Editing surfaces register here; the
 * shell reads the list and flushes.
 *
 * Client-safe and framework-free on purpose — the shell, a route guard and an
 * editor can all import it without pulling React or the router in.
 */

export interface DirtySurface {
  /** Human name shown in the session-expiry warning, e.g. "Lesson editor". */
  label: string
  /** Persist the buffer. Called before a context switch, never after a discard. */
  flush: () => Promise<void> | void
}

const surfaces = new Map<string, DirtySurface>()

/** Register a surface; returns the unregister function for effect cleanup. */
export function registerDirtySurface(id: string, surface: DirtySurface): () => void {
  surfaces.set(id, surface)
  return () => {
    surfaces.delete(id)
  }
}

export function listDirtySurfaces(): DirtySurface[] {
  return Array.from(surfaces.values())
}

/**
 * Flush every registered surface, in registration order. The first failure stops
 * the flush and is rethrown, so a navigation blocked by an unsaved buffer is
 * blocked by the surface that could not save — never silently skipped.
 */
export async function flushDirtySurfaces(): Promise<void> {
  for (const surface of listDirtySurfaces()) {
    await surface.flush()
  }
}
