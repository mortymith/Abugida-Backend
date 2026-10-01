/**
 * @module resolve
 *
 * Hostname → tenant. Framework-independent on purpose: the same function backs
 * the Hono middleware, the dashboard's server functions and the tests, so a
 * hostname cannot mean two different things in two places.
 *
 * The model is one subdomain, one tenant:
 *
 *   dashboard.abugida.com   platform — organization management, not a tenant
 *   api.abugida.com         platform — reserved, never a tenant
 *   abugida.com             apex — marketing, not a tenant
 *   acme.abugida.com        tenant — slug `acme`
 *   anything.else.com       external — not ours; never treated as a tenant
 *
 * Development needs no special casing: configure `baseDomain: 'localhost'` and
 * `acme.localhost:3000` resolves exactly like production.
 */

import { isReservedTenantSlug, validateTenantSlug } from './slug'
import { normalizeBaseDomain, type TenantUrlConfig } from './url'

export interface TenantDomainConfig extends TenantUrlConfig {
  /**
   * Additional reserved subdomains, on top of {@link RESERVED_TENANT_SLUGS}.
   * Defaults to the platform list; pass a list to replace it (not to extend it)
   * so a deployment cannot accidentally resolve `api` as a tenant.
   */
  reservedSlugs?: readonly string[]
}

/** What a hostname turned out to be. */
export type TenantHostResolution =
  /** A well-formed, non-reserved subdomain of the tenant domain. */
  | { kind: 'tenant'; slug: string; hostname: string }
  /** A platform host (`dashboard`, `api`, `www`, …). Not a tenant. */
  | { kind: 'platform'; subdomain: string; hostname: string }
  /** The bare tenant domain — the marketing apex. Not a tenant. */
  | { kind: 'apex'; hostname: string }
  /** A host outside the configured tenant domain. */
  | { kind: 'external'; hostname: string }
  /** Unparseable, or a subdomain that cannot be a tenant slug. */
  | {
      kind: 'invalid'
      hostname: string
      reason: 'empty' | 'malformed' | 'invalid_slug'
      detail: string
    }

/**
 * Strip what a `Host` header carries beyond the name: case, a trailing root
 * dot, a bracketed IPv6 literal, and the port (which is what a development
 * hostname like `acme.localhost:3000` always has).
 */
export function normalizeHostname(input: string | null | undefined): string | null {
  if (typeof input !== 'string') return null
  let host = input.trim().toLowerCase()
  if (!host) return null

  // IPv6 literal — never a tenant host.
  if (host.startsWith('[')) return null

  const firstColon = host.indexOf(':')
  if (firstColon !== -1) {
    const port = host.slice(firstColon + 1)
    // A host with more than one colon is a bare IPv6 address, not host:port.
    if (port.includes(':') || !/^\d{1,5}$/.test(port)) return null
    host = host.slice(0, firstColon)
  }

  host = host.replace(/\.$/, '')
  if (!host) return null
  if (!/^[a-z0-9.-]+$/.test(host)) return null
  if (host.includes('..') || host.startsWith('-') || host.endsWith('-')) return null
  return host
}

/**
 * Resolve a hostname against the tenant domain configuration.
 *
 * Only `{ kind: 'tenant' }` may be used to build a tenant context, and even
 * then the caller must still verify membership — a hostname is a claim, not a
 * grant.
 */
export function resolveTenantFromHostname(
  hostname: string | null | undefined,
  config: TenantDomainConfig,
): TenantHostResolution {
  const host = normalizeHostname(hostname)
  if (!host) {
    return {
      kind: 'invalid',
      hostname: '',
      reason: typeof hostname === 'string' && hostname.trim() === '' ? 'empty' : 'malformed',
      detail: 'A hostname is required to resolve a tenant.',
    }
  }

  let baseDomain: string
  try {
    baseDomain = normalizeBaseDomain(config.baseDomain)
  } catch {
    return {
      kind: 'invalid',
      hostname: host,
      reason: 'malformed',
      detail: 'The configured tenant base domain is not a usable domain.',
    }
  }

  if (host === baseDomain) return { kind: 'apex', hostname: host }
  if (!host.endsWith(`.${baseDomain}`)) return { kind: 'external', hostname: host }

  const subdomain = host.slice(0, -(baseDomain.length + 1))
  if (!subdomain || subdomain.includes('.')) {
    // A deeper label (`a.b.abugida.com`) is not part of the tenancy model.
    return { kind: 'external', hostname: host }
  }

  if (isReserved(subdomain, config)) return { kind: 'platform', subdomain, hostname: host }

  const validation = validateTenantSlug(subdomain)
  if (!validation.ok) {
    return { kind: 'invalid', hostname: host, reason: 'invalid_slug', detail: validation.message }
  }
  return { kind: 'tenant', slug: validation.slug, hostname: host }
}

function isReserved(subdomain: string, config: TenantDomainConfig): boolean {
  const reserved = config.reservedSlugs
  if (reserved) return reserved.some((slug) => slug.toLowerCase() === subdomain)
  return isReservedTenantSlug(subdomain)
}

/** Whether a hostname names a tenant. Never throws; a bad host is simply not one. */
export function isTenantHostname(
  hostname: string | null | undefined,
  config: TenantDomainConfig,
): boolean {
  return resolveTenantFromHostname(hostname, config).kind === 'tenant'
}
