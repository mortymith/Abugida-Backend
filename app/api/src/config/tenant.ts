/**
 * @module config/tenant
 *
 * The API's tenancy configuration, projected from the environment contract
 * `@abugida/tenant` owns (`tenantEnvShape`, spread into `app_config.ts`).
 *
 * Two singletons live here, both defined by the shared package rather than
 * locally:
 *
 *   - `tenantConfig` — which hostnames are tenant workspaces.
 *   - `tenantStore`  — the read side of tenancy, over the `organization` and
 *                      `member` tables `@abugida/database` owns.
 *
 * The API never resolves a hostname or reads a membership itself; the tenant
 * middleware (see `../middleware/tenant.middleware.ts`) does, using these.
 */

import type { TenantDomainConfig, TenantStore } from '@abugida/tenant'
import { resolveTenantConfig } from '@abugida/tenant/env'
import { createDrizzleTenantStore } from '@abugida/tenant/store'

import { appConfig } from './app_config'
import { db } from './database'

/** The domain the API treats as the tenant domain. */
export const tenantConfig: TenantDomainConfig = resolveTenantConfig({
  TENANT_BASE_DOMAIN: appConfig.TENANT_BASE_DOMAIN,
  TENANT_PROTOCOL: appConfig.TENANT_PROTOCOL,
  TENANT_PORT: appConfig.TENANT_PORT,
  TENANT_PLATFORM_SUBDOMAIN: appConfig.TENANT_PLATFORM_SUBDOMAIN,
})

/**
 * Tenant and membership lookups, over the existing Drizzle handle.
 *
 * Reads only: creating and writing organizations stays with Better Auth's
 * organization plugin, and the tables stay owned by `@abugida/database`.
 */
export const tenantStore: TenantStore = createDrizzleTenantStore(db)
