/**
 * @module tenant.test
 * @description Unit tests for the API's tenancy wiring.
 *
 * The tenancy rules themselves (slug rules, hostname resolution, membership
 * and permission checks) are owned by `@abugida/tenant` and tested there. What
 * matters here is that the API wires them from one place and does not grow a
 * second implementation: the environment keys come from `tenantEnvShape`, and
 * both the domain config and the store are the shared package's.
 */

import { describe, it, expect } from 'bun:test'
import { parseAppConfig } from '@/config/app_config'
import { tenantConfig, tenantStore } from '@/config/tenant'
import { resolveTenantFromHostname } from '@abugida/tenant'
import { getTenantUrl } from '@abugida/tenant/url'

function baseEnv(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    BETTER_AUTH_SECRET: 'xK9mP2vL8nQ4wR7jT5hB3cF6gY1sD0aE',
    BETTER_AUTH_URL: 'http://localhost:3000',
    ...overrides,
  }
}

describe('tenant environment contract', () => {
  it('defaults to the production tenant domain', () => {
    const config = parseAppConfig(baseEnv())
    expect(config.TENANT_BASE_DOMAIN).toBe('abugida.com')
    expect(config.TENANT_PROTOCOL).toBe('https')
    expect(config.TENANT_PLATFORM_SUBDOMAIN).toBe('dashboard')
    expect(config.TENANT_PORT).toBeUndefined()
  })

  it('accepts a development tenant domain with its port', () => {
    const config = parseAppConfig(
      baseEnv({ TENANT_BASE_DOMAIN: 'localhost', TENANT_PROTOCOL: 'http', TENANT_PORT: '3000' }),
    )
    expect(config.TENANT_BASE_DOMAIN).toBe('localhost')
    expect(config.TENANT_PROTOCOL).toBe('http')
    expect(config.TENANT_PORT).toBe(3000)
  })

  it('rejects an unknown protocol', () => {
    expect(() => parseAppConfig(baseEnv({ TENANT_PROTOCOL: 'ftp' }))).toThrow()
  })
})

describe('API tenancy singletons', () => {
  it('resolves hostnames with the shared resolver', () => {
    expect(resolveTenantFromHostname('acme.abugida.com', tenantConfig)).toMatchObject({
      kind: 'tenant',
      slug: 'acme',
    })
    expect(resolveTenantFromHostname('api.abugida.com', tenantConfig)).toMatchObject({
      kind: 'platform',
    })
  })

  it('builds tenant URLs with the shared builder', () => {
    expect(getTenantUrl({ ...tenantConfig, slug: 'acme' })).toMatch(/^https?:\/\/acme\./)
  })

  it('exposes the shared read store over the API database handle', () => {
    expect(typeof tenantStore.findTenantBySlug).toBe('function')
    expect(typeof tenantStore.findTenantById).toBe('function')
    expect(typeof tenantStore.findMembership).toBe('function')
  })
})
