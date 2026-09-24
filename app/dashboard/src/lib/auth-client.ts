import { createAuthClient } from '@abugida/auth/tanstack/client'

export const authClient = createAuthClient({
  basePath: import.meta.env.VITE_AUTH_BASE_PATH ?? '/auth',
})
