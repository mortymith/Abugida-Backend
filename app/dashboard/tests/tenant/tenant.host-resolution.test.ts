import { describe, expect, test } from 'bun:test'
import { resolveTenantFromHostname } from '@abugida/tenant'
import type { TenantDomainConfig } from '@abugida/tenant'
import { getTenantHostname } from '@abugida/tenant/url'
import { tenantUrlConfig } from '#/config/tenant.config'

/**
 * Does the dashboard resolve the subdomain it was given?
 *
 * The rules themselves are tested in `@abugida/tenant`; what is pinned here is
 * that the dashboard's *own* configuration feeds them correctly, and that
 * resolving a hostname and building its URL are two ends of one string.
 *
 * No environment parsing here on purpose: `tenantUrlConfig` reads only
 * `import.meta.env`, so this suite runs in any checkout. For the server-side
 * config (`TENANT_BASE_DOMAIN`, etc.) run `pnpm probe:tenant`.
 */
const base = import.meta.env.VITE_WORKSPACE_DOMAIN ?? 'abugida.com'

/** The local development shape: the dashboard is served on port 3000. */
const dev: TenantDomainConfig = { baseDomain: 'localhost', protocol: 'http', port: 3000 }

describe('dashboard hostname resolution', () => {
  test('a tenant subdomain resolves to its slug', () => {
    expect(
      resolveTenantFromHostname(`acme.${base}`, { ...tenantUrlConfig, baseDomain: base }),
    ).toMatchObject({ kind: 'tenant', slug: 'acme' })
  })

  test('the platform surface and the apex are never tenants', () => {
    for (const hostname of [`dashboard.${base}`, `api.${base}`, `www.${base}`, base]) {
      const result = resolveTenantFromHostname(hostname, { ...tenantUrlConfig, baseDomain: base })
      expect(result.kind === 'tenant').toBe(false)
    }
  })

  test('a foreign host is external, not a tenant', () => {
    expect(
      resolveTenantFromHostname(`acme.example.com`, { ...tenantUrlConfig, baseDomain: base }),
    ).toMatchObject({
      kind: 'external',
    })
  })

  test('the development port does not change the outcome', () => {
    expect(resolveTenantFromHostname('acme.localhost:3000', dev)).toMatchObject({
      kind: 'tenant',
      slug: 'acme',
    })
    expect(resolveTenantFromHostname('dashboard.localhost:3000', dev)).toMatchObject({
      kind: 'platform',
    })
  })
})

describe('resolution and URL building agree', () => {
  test('a resolved hostname is rebuilt from its own slug', () => {
    // The invariant that keeps links honest: whatever the wizard shows and
    // wherever it sends the user must be the same tenant the request resolved.
    for (const hostname of [`acme.${base}`, `school-2.${base}`]) {
      const result = resolveTenantFromHostname(hostname, { ...tenantUrlConfig, baseDomain: base })
      expect(result.kind).toBe('tenant')
      if (result.kind !== 'tenant') continue
      expect(getTenantHostname(result.slug, { ...tenantUrlConfig, baseDomain: base })).toBe(
        hostname,
      )
    }
  })
})
