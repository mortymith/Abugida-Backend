import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'abugida.last-provider'

export type Provider = 'google' | 'telegram-oidc'

export function useLastProvider() {
  // Start with the same value on the server and client. Reading localStorage
  // during the initial render makes the provider order differ during hydration.
  const [lastProvider, setLastProviderState] = useState<Provider | null>(null)

  const setLastProvider = useCallback((provider: Provider) => {
    localStorage.setItem(STORAGE_KEY, provider)
    setLastProviderState(provider)
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'google' || stored === 'telegram-oidc') {
      setLastProviderState(stored)
    }
  }, [])

  return { lastProvider, setLastProvider }
}
