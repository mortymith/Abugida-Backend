/**
 * @module types
 *
 * Shared Hono environment types for the API middleware layer. `AppEnv` is the
 * union of every variable the middleware stack writes to the request context:
 * session/user from the shared auth package plus the webhook API-key principal.
 */

import type { Hono } from 'hono'
import type { HonoAuthVariables } from '@abugida/auth/hono'

/** Authenticated webhook principal resolved from `X-API-Key`. */
export interface ResolvedApiKey {
  publicId: string
  name: string
  userId: string
  scopes: string[]
  rateLimit: number
  keyPrefix: string
}

export interface AppVariables extends HonoAuthVariables {
  apiKey: ResolvedApiKey | null
}

export type AppEnv = { Bindings: object; Variables: AppVariables }

export type AppHono = Hono<AppEnv>
