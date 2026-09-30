import { useEffect, useState } from 'react'

/**
 * Browser connectivity, for the spec's **Offline** resilience state.
 *
 * Spec 11 requires a *persistent banner*, not a toast, and surfaces that cannot
 * be completed offline (a federated sign-in round-trip, a 2FA check, a
 * provisioning write) must be **disabled with a reason** rather than failing
 * silently. Both need the same signal, so it lives here once.
 *
 * Starts `true` so server-rendered markup matches the first client render —
 * reading `navigator.onLine` during render would desynchronise hydration.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  return online
}
