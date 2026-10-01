/**
 * Server-side tenancy for the dashboard.
 *
 * Two things live here and neither is reimplemented anywhere else:
 *
 *  - `tenantDomainConfig` / `tenantStore` — the same singletons the API builds
 *    from the same `tenantEnvShape`, so both apps resolve a hostname to the
 *    same organization.
 *  - `resolveCurrentTenant()` — what the request hostname means on the server:
 *    a tenant workspace, the platform surface (`dashboard.…`), the marketing
 *    apex, or nothing at all.
 *
 * A resolved host is not an authorized tenant. Callers that need a tenant scope
 * go through `requireTenantContextBySlug` (`@abugida/tenant/authorization`),
 * which additionally verifies the caller's membership.
 *
 * Server-only.
 */
import { getRequest } from '@tanstack/react-start/server'
import { resolveTenantFromHostname } from '@abugida/tenant'
import type { TenantDomainConfig, TenantHostResolution, TenantStore } from '@abugida/tenant'
import { requireTenantContextBySlug } from '@abugida/tenant/authorization'
import { resolveTenantConfig } from '@abugida/tenant/env'
import { createDrizzleTenantStore } from '@abugida/tenant/store'

import { env } from './app.config'
import { db } from './db.config'

/** The domain this deployment serves tenant workspaces from. */
export const tenantDomainConfig: TenantDomainConfig = resolveTenantConfig({
  TENANT_BASE_DOMAIN: env.TENANT_BASE_DOMAIN,
  TENANT_PROTOCOL: env.TENANT_PROTOCOL,
  TENANT_PORT: env.TENANT_PORT,
  TENANT_PLATFORM_SUBDOMAIN: env.TENANT_PLATFORM_SUBDOMAIN,
})

/**
 * Tenant and membership lookups over the dashboard's Drizzle handle. Reads
 * only — creating organizations stays with Better Auth's organization plugin.
 */
export const tenantStore: TenantStore = createDrizzleTenantStore(db)

/**
 * Resolve a hostname with **the dashboard's** configuration.
 *
 * Pure: no request context, no database. This is the function to reach for when
 * a hostname arrives from somewhere other than the current request (a webhook,
 * a background job, a test); `resolveCurrentTenantHost()` below is this one
 * applied to the request in flight.
 */
export function resolveTenantHost(hostname: string | null | undefined): TenantHostResolution {
  return resolveTenantFromHostname(hostname, tenantDomainConfig)
}

/**
 * What the current request's hostname is.
 *
 * `dashboard.abugida.com` resolves to `platform` and the bare apex to `apex`;
 * neither is a tenant, and neither is ever given a `TenantContext`.
 */
export async function resolveCurrentTenantHost(): Promise<TenantHostResolution> {
  const { hostname } = new URL(getRequest().url)
  return resolveTenantHost(hostname)
}

/** The tenant slug the current request is scoped to, or `null`. */
export async function currentTenantSlug(): Promise<string | null> {
  const host = await resolveCurrentTenantHost()
  return host.kind === 'tenant' ? host.slug : null
}

/**
 * The authorized tenant context for the current request, or `null` when the
 * request is not on a tenant subdomain or the caller cannot open that
 * workspace. Non-throwing by design: the dashboard decides what an absent
 * context means for a given screen.
 */
export async function requireCurrentTenant(userId: string | null) {
  const slug = await currentTenantSlug()
  if (!slug) return null

  try {
    return await requireTenantContextBySlug({ store: tenantStore, slug, userId })
  } catch {
    return null
  }
}
