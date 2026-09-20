import { createAuthClient } from '@abugida/auth/tanstack/client'

export const authClient = createAuthClient({
  baseUrl: import.meta.env.VITE_AUTH_BASE_URL ?? 'http://localhost:3000/auth',
})
