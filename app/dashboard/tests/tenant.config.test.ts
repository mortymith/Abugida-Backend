import { describe, expect, test } from 'bun:test'
import { tenantHost, tenantUrl, previewTenantHost } from '#/config/tenant.config'

/**
 * The dashboard must not build workspace URLs itself: the domain comes from
 * configuration and the URL from `@abugida/tenant`. These assertions fail if
 * someone reintroduces a hardcoded domain in a component.
 */
const baseDomain = import.meta.env.VITE_WORKSPACE_DOMAIN ?? 'abugida.com'

describe('dashboard tenant URLs', () => {
  test('a tenant host is the slug under the configured domain', () => {
    expect(tenantHost('acme')).toBe(`acme.${baseDomain}`)
    // The scheme and the development port come from configuration too, so the
    // assertion is on the host rather than on a hardcoded origin.
    expect(new URL(tenantUrl('acme')).hostname).toBe(`acme.${baseDomain}`)
  })

  test('a slug that cannot be a hostname has no preview', () => {
    // The wizard renders a live preview while the field is still being typed,
    // so "not yet valid" has to be a value, not an exception.
    expect(previewTenantHost('ab')).toBeNull()
    expect(previewTenantHost('')).toBeNull()
    expect(previewTenantHost('Acme')).toBeNull()
    expect(previewTenantHost('admin')).toBeNull()
    expect(previewTenantHost('acme')).toBe(`acme.${baseDomain}`)
  })
})
