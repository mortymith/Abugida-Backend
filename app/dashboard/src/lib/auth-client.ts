import { createAuthClient } from '@abugida/auth/tanstack'

export const authClient = createAuthClient({
  baseUrl: import.meta.env.VITE_AUTH_BASE_URL ?? 'http://localhost:3000/auth',
})
