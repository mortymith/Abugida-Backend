/**
 * Tenant URLs in the browser.
 *
 * Client-safe on purpose: it reads only `import.meta.env.VITE_*` and imports
 * only `@abugida/tenant/url`, so any component may build or show a workspace
 * link without pulling in the server config, the database or Better Auth.
 *
 * The rules — what a slug may be, which names are reserved, which host is a
 * platform host — belong to `@abugida/tenant`; this file only says *which*
 * domain this deployment uses.
 */
import { validateTenantSlug } from '@abugida/tenant'
import { getTenantHostname, getTenantUrl } from '@abugida/tenant/url'
import type { TenantUrlConfig } from '@abugida/tenant/url'

/** The dev port the dashboard is hardcoded to (`vite dev --port 3000`). */
const DEV_PORT = 3000

/** Where this deployment serves tenant workspaces. */
export const tenantUrlConfig: TenantUrlConfig = {
  baseDomain: import.meta.env.VITE_WORKSPACE_DOMAIN ?? 'abugida.com',
  protocol: import.meta.env.PROD ? 'https' : 'http',
  ...(import.meta.env.PROD ? {} : { port: DEV_PORT }),
}

/** `acme.abugida.com` — the host only, for display next to an input. */
export function tenantHost(slug: string): string {
  return getTenantHostname(slug, tenantUrlConfig)
}

/**
 * The host for a slug that is still being typed, or `null` while it is not yet
 * a usable hostname. For live UI only — never for building a link to follow.
 */
export function previewTenantHost(slug: string): string | null {
  const validation = validateTenantSlug(slug)
  return validation.ok ? tenantHost(validation.slug) : null
}

/** `https://acme.abugida.com` — where a workspace is reached after creation. */
export function tenantUrl(slug: string): string {
  return getTenantUrl({ ...tenantUrlConfig, slug })
}
