/**
 * @module types
 *
 * Shared Hono environment types for the API middleware layer. `AppEnv` is the
 * union of every variable the middleware stack writes to the request context:
 * session/user from the shared auth package plus the webhook API-key principal
 * and the resolved tenant organization id.
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
  /**
   * The organization id every tenant-scoped repository query must filter by.
   * Resolved from the session's `activeOrganizationId` (for cookie/bearer
   * auth) or from the API key's bound organization (for webhook auth).
   *
   * `null` when the request is unauthenticated or the user has no active
   * organization. Public catalog endpoints that serve cross-tenant content
   * (the course catalog) do NOT read this; every other endpoint should.
   */
  tenantOrgId: string | null
}

export type AppEnv = { Bindings: object; Variables: AppVariables }

export type AppHono = Hono<AppEnv>
