import { describe, expect, test } from 'bun:test'
import {
  isTenantHostname,
  normalizeHostname,
  resolveTenantFromHostname,
  type TenantDomainConfig,
} from '../src/resolve'

const prod: TenantDomainConfig = { baseDomain: 'abugida.com', protocol: 'https' }
const dev: TenantDomainConfig = { baseDomain: 'localhost', protocol: 'http', port: 3000 }

describe('normalizeHostname', () => {
  test('lowercases and drops a trailing root dot', () => {
    expect(normalizeHostname('ACME.abugida.com.')).toBe('acme.abugida.com')
  })

  test('drops the port', () => {
    expect(normalizeHostname('acme.localhost:3000')).toBe('acme.localhost')
  })

  test('rejects values that cannot be a hostname', () => {
    for (const value of [
      '',
      '   ',
      null,
      undefined,
      'not a host',
      '[::1]',
      'a..b',
      '-lead.com',
      'host:abc',
    ]) {
      expect(normalizeHostname(value)).toBeNull()
    }
  })
})

describe('resolveTenantFromHostname — production', () => {
  test('a tenant subdomain resolves to its slug', () => {
    expect(resolveTenantFromHostname('acme.abugida.com', prod)).toEqual({
      kind: 'tenant',
      slug: 'acme',
      hostname: 'acme.abugida.com',
    })
    expect(resolveTenantFromHostname('school.abugida.com', prod)).toMatchObject({
      kind: 'tenant',
      slug: 'school',
    })
  })

  test('platform hosts are never tenants', () => {
    for (const host of [
      'dashboard.abugida.com',
      'api.abugida.com',
      'www.abugida.com',
      'auth.abugida.com',
      'docs.abugida.com',
      'admin.abugida.com',
    ]) {
      expect(resolveTenantFromHostname(host, prod)).toMatchObject({ kind: 'platform' })
      expect(isTenantHostname(host, prod)).toBe(false)
    }
  })

  test('the apex is the marketing site, not a tenant', () => {
    expect(resolveTenantFromHostname('abugida.com', prod)).toEqual({
      kind: 'apex',
      hostname: 'abugida.com',
    })
  })

  test('a host outside the tenant domain is external, never a tenant', () => {
    expect(resolveTenantFromHostname('acme.example.com', prod)).toMatchObject({ kind: 'external' })
    expect(resolveTenantFromHostname('abugida.com.evil.test', prod)).toMatchObject({
      kind: 'external',
    })
    expect(resolveTenantFromHostname('acme.abugida.com.evil.test', prod)).toMatchObject({
      kind: 'external',
    })
  })

  test('a deeper label is not part of the tenancy model', () => {
    expect(resolveTenantFromHostname('a.b.abugida.com', prod)).toMatchObject({ kind: 'external' })
  })

  test('a subdomain that cannot be a slug is invalid, not a tenant', () => {
    expect(resolveTenantFromHostname('ab.abugida.com', prod)).toMatchObject({
      kind: 'invalid',
      reason: 'invalid_slug',
    })
    expect(resolveTenantFromHostname('a--b.abugida.com', prod)).toMatchObject({
      kind: 'invalid',
      reason: 'invalid_slug',
    })
  })

  test('unusable hosts are invalid with a reason', () => {
    expect(resolveTenantFromHostname('', prod)).toMatchObject({ kind: 'invalid', reason: 'empty' })
    expect(resolveTenantFromHostname('not a host', prod)).toMatchObject({
      kind: 'invalid',
      reason: 'malformed',
    })
  })

  test('an invalid base domain never yields a tenant', () => {
    expect(resolveTenantFromHostname('acme.abugida.com', { baseDomain: 'nope' })).toMatchObject({
      kind: 'invalid',
      reason: 'malformed',
    })
  })

  test('an explicit reserved list replaces the default one', () => {
    const config: TenantDomainConfig = { ...prod, reservedSlugs: ['console'] }
    expect(resolveTenantFromHostname('acme.abugida.com', config)).toMatchObject({ kind: 'tenant' })
    expect(resolveTenantFromHostname('console.abugida.com', config)).toMatchObject({
      kind: 'platform',
    })
  })
})

describe('resolveTenantFromHostname — development', () => {
  test('a port-carrying development hostname resolves like production', () => {
    expect(resolveTenantFromHostname('acme.localhost:3000', dev)).toEqual({
      kind: 'tenant',
      slug: 'acme',
      hostname: 'acme.localhost',
    })
  })

  test('the platform host is still the platform in development', () => {
    expect(resolveTenantFromHostname('dashboard.localhost:3000', dev)).toMatchObject({
      kind: 'platform',
      subdomain: 'dashboard',
    })
  })

  test('the development apex is the apex', () => {
    expect(resolveTenantFromHostname('localhost:3000', dev)).toMatchObject({ kind: 'apex' })
  })

  test('a production-shaped host is external to a development deployment', () => {
    expect(resolveTenantFromHostname('acme.abugida.com', dev)).toMatchObject({ kind: 'external' })
  })
})
