import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'abugida.last-provider'

export type Provider = 'google' | 'telegram-oidc'

export function useLastProvider() {
  const [lastProvider, setLastProviderState] = useState<Provider | null>(() => {
    if (typeof window === 'undefined') return null
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'google' || stored === 'telegram-oidc') return stored
    return null
  })

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
