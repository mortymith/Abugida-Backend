import { createAuthClient } from '@abugida/auth/tanstack'
import { env } from '#/config/app.config'

export const authClient = createAuthClient({
  baseUrl: env.VITE_AUTH_BASE_URL,
})
