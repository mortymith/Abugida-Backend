import { describe, expect, test } from 'bun:test'
import { TenantConfigError, TenantSlugError } from '../src/errors'
import {
  DEFAULT_PLATFORM_SUBDOMAIN,
  getPlatformUrl,
  getTenantHostname,
  getTenantUrl,
  normalizeBaseDomain,
} from '../src/url'

describe('getTenantUrl', () => {
  test('builds a production tenant URL', () => {
    expect(getTenantUrl({ slug: 'acme', baseDomain: 'abugida.com', protocol: 'https' })).toBe(
      'https://acme.abugida.com',
    )
  })

  test('defaults to https and to the configured base domain', () => {
    expect(getTenantUrl({ slug: 'acme', baseDomain: 'abugida.com' })).toBe(
      'https://acme.abugida.com',
    )
  })

  test('builds a development tenant URL with its port', () => {
    expect(
      getTenantUrl({
        slug: 'acme',
        baseDomain: 'localhost',
        protocol: 'http',
        port: 3000,
      }),
    ).toBe('http://acme.localhost:3000')
  })

  test('canonicalizes the slug it is given', () => {
    expect(getTenantUrl({ slug: 'school-2', baseDomain: 'abugida.com' })).toBe(
      'https://school-2.abugida.com',
    )
  })

  test('refuses a non-canonical slug instead of linking to nowhere', () => {
    expect(() => getTenantUrl({ slug: 'Acme', baseDomain: 'abugida.com' })).toThrow(TenantSlugError)
    expect(() => getTenantUrl({ slug: 'api', baseDomain: 'abugida.com' })).toThrow(TenantSlugError)
    expect(() => getTenantUrl({ slug: '', baseDomain: 'abugida.com' })).toThrow(TenantSlugError)
  })

  test('refuses an unusable base domain', () => {
    expect(() => getTenantUrl({ slug: 'acme', baseDomain: '' })).toThrow(TenantConfigError)
    expect(() => getTenantUrl({ slug: 'acme', baseDomain: 'not a domain' })).toThrow(
      TenantConfigError,
    )
  })

  test('returns the host alone for callers that build their own path', () => {
    expect(getTenantHostname('acme', { baseDomain: 'https://*.abugida.com/' })).toBe(
      'acme.abugida.com',
    )
  })
})

describe('normalizeBaseDomain', () => {
  test('accepts the shapes an env var realistically holds', () => {
    expect(normalizeBaseDomain('abugida.com')).toBe('abugida.com')
    expect(normalizeBaseDomain('ABUGIDA.com')).toBe('abugida.com')
    expect(normalizeBaseDomain('*.abugida.com')).toBe('abugida.com')
    expect(normalizeBaseDomain('https://abugida.com/')).toBe('abugida.com')
    expect(normalizeBaseDomain('abugida.com.')).toBe('abugida.com')
    // The development deployment's single-label domain.
    expect(normalizeBaseDomain('localhost')).toBe('localhost')
  })

  test('rejects values that would produce nonsense hosts', () => {
    for (const value of ['', '  ', 'abugida', 'a b.com']) {
      expect(() => normalizeBaseDomain(value)).toThrow(TenantConfigError)
    }
  })
})

describe('getPlatformUrl', () => {
  test('defaults to the dashboard subdomain', () => {
    expect(DEFAULT_PLATFORM_SUBDOMAIN).toBe('dashboard')
    expect(getPlatformUrl({ baseDomain: 'abugida.com' })).toBe('https://dashboard.abugida.com')
  })

  test('honours an explicit platform subdomain and development settings', () => {
    expect(getPlatformUrl({ baseDomain: 'abugida.com', platformSubdomain: 'Admin' })).toBe(
      'https://admin.abugida.com',
    )
    expect(getPlatformUrl({ baseDomain: 'localhost', protocol: 'http', port: 3000 })).toBe(
      'http://dashboard.localhost:3000',
    )
  })
})
