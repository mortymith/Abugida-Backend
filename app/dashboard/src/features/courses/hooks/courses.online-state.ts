/**
 * Offline detection for the Lesson Editor — spec 12 § 8.1.2.
 *
 * Part 11 § Resilience renders an offline surface read-only, but the item
 * pane is the documented exception (Part 04 S-2.7): because the body is a
 * local buffer with a 1000ms mirror, locking the author out would protect
 * nothing and cost the whole session. What is suspended offline is the
 * **server write path**, not the editor.
 *
 * This hook surfaces the browser's `navigator.onLine` state plus the
 * `online` / `offline` window events so the autosave matrix can branch on
 * it without each consumer re-implementing the listener.
 */
import { useEffect, useState } from 'react'

export interface OnlineState {
  /** Whether the browser reports an active network connection. */
  online: boolean
  /**
   * The timestamp of the most recent transition. Useful for the offline
   * banner's "since HH:MM" wording.
   */
  changedAt: Date
}

/**
 * React hook that tracks `navigator.onLine`. SSR-safe: returns `online:
 * true` until the client hydrates and the listeners attach.
 */
export function useOnlineState(): OnlineState {
  const [state, setState] = useState<OnlineState>(() => ({
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    changedAt: new Date(),
  }))

  useEffect(() => {
    const handleOnline = () => setState({ online: true, changedAt: new Date() })
    const handleOffline = () => setState({ online: false, changedAt: new Date() })
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    // Sync to the current state in case the listener was attached after a
    // transition (rare, but possible during dev hot-reload).
    setState({ online: navigator.onLine, changedAt: new Date() })
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return state
}
