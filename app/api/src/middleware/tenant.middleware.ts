/**
 * @module tenant
 *
 * Tenant middleware for the API. Composition only — the resolution, the
 * membership check and the status codes all live in `@abugida/tenant`
 * (`/hono`), and the configuration comes from `../config/tenant`.
 *
 * Two middlewares, mounted in this order:
 *
 *   1. {@link tenantHostMiddleware} resolves the request hostname once and
 *      publishes the outcome on the context. It needs neither a session nor a
 *      database, so it runs on every request.
 *   2. {@link requireTenantMiddleware} turns a *tenant* host into an
 *      authorized `TenantContext`: session → tenant lookup → membership. It is
 *      mounted behind the session middleware, and it only acts on requests that
 *      actually arrived on a tenant subdomain.
 *
 * A request on `api.*`, `dashboard.*`, `www.*` or the bare apex is a platform
 * request, not a tenant request: it passes through with `tenant === null`. A
 * route that only exists inside a workspace opts in with
 * `requireTenantHostOnly()`.
 */

import type { MiddlewareHandler } from 'hono'
import {
  requireTenantContextMiddleware,
  tenantHostMiddleware,
  type TenantVariables,
} from '@abugida/tenant/hono'
import { appConfig } from '../config/app_config'
import { tenantConfig, tenantStore } from '../config/tenant'
import type { AppEnv } from './types'

export type { TenantVariables }

/**
 * Resolve the hostname onto the context. Never rejects — an unknown, reserved
 * or foreign host is a value the downstream middleware reasons about.
 */
export function tenantHostMiddlewareForApi(): MiddlewareHandler<AppEnv> {
  return tenantHostMiddleware(tenantConfig) as unknown as MiddlewareHandler<AppEnv>
}

/**
 * Publish `c.get('tenant')` when the request arrived on a tenant subdomain.
 *
 * Status codes preserve the distinctions a client needs: 404 unknown
 * workspace, 401 no session, 403 authenticated but not a member. Changing the
 * `Host` header to reach another organization lands on the 403.
 */
export function requireTenantMiddleware(): MiddlewareHandler<AppEnv> {
  return requireTenantContextMiddleware({
    store: tenantStore,
    errorTypeBaseUrl: appConfig.ERROR_BASE_URL,
  }) as unknown as MiddlewareHandler<AppEnv>
}

/**
 * The stricter variant, for routes that only exist inside a workspace: a
 * platform host is a 404 there rather than a pass-through.
 */
export function requireTenantHostOnly(): MiddlewareHandler<AppEnv> {
  return requireTenantContextMiddleware({
    store: tenantStore,
    requireTenantHost: true,
    errorTypeBaseUrl: appConfig.ERROR_BASE_URL,
  }) as unknown as MiddlewareHandler<AppEnv>
}
