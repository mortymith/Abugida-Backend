import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'

import { authClient } from '#/lib/auth-client'

/** Signs the user out and returns them to the configured login route. */
export function useLogout() {
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  async function logout() {
    if (isLoggingOut) return
    setIsLoggingOut(true)

    try {
      await authClient.signOut()
      await navigate({ to: import.meta.env.VITE_LOGIN_PATH ?? '/login' })
    } finally {
      setIsLoggingOut(false)
    }
  }

  return { logout, isLoggingOut }
}
