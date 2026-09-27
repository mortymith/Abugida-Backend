/**
 * @module middleware/tanstack
 *
 * TanStack Start integration. Re-exports from server and client entry points.
 *
 * **Important:** For client-side code, import from `@abugida/auth/tanstack/client`
 * to avoid pulling server-only dependencies into the browser bundle. Import
 * from `@abugida/auth/tanstack/server` for server-only code and from
 * `@abugida/auth/tanstack/guard` in route modules.
 *
 * This barrel file is kept for backwards compatibility but should be avoided
 * in new code — prefer the explicit `/server` or `/client` subpath.
 */

export {
  createAuthServerFunctions,
  requireAuthBeforeLoad,
  type AuthServerFunctions,
} from './server'

export { createAuthClient, type AuthClientOptions } from './client'
