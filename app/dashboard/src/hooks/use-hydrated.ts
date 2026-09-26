import { useEffect, useState } from 'react'

/**
 * `false` on the server and on the first client render, `true` afterwards.
 *
 * Use it to keep markup that depends on browser-only or time-sensitive state
 * (query fetch status, dnd-kit's module-level id counters, …) out of the first
 * client render. Rendering such state during hydration produces attribute
 * mismatches React cannot patch up.
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  return hydrated
}
