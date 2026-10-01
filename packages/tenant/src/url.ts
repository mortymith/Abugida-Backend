/**
 * @module url
 *
 * The single implementation of "where does this tenant live". Both apps build
 * tenant links here instead of string-concatenating a domain, so a change of
 * base domain (or a local development setup) is a configuration change and not
 * a hunt for `.abugida.com` literals.
 *
 * Client-safe: no database, no better-auth, no framework.
 */

import { TenantConfigError, TenantSlugError } from './errors'
import { validateTenantSlug } from './slug'

/** Everything needed to build a tenant or platform URL. */
export interface TenantUrlConfig {
  /**
   * The domain tenant workspaces are served from, e.g. `abugida.com`. A URL or
   * a scheme is tolerated (`https://abugida.com`) and normalized away.
   *
   * Development uses `localhost`, which yields `acme.localhost:3000` — the
   * subdomain model works unchanged, only the configured domain differs.
   */
  baseDomain: string
  /** Default `https`. */
  protocol?: 'http' | 'https'
  /**
   * Development port appended to the host, e.g. `3000` → `acme.localhost:3000`.
   * Omit in production; the scheme carries the default.
   */
  port?: number | string
  /** The subdomain serving the platform surface. Default `dashboard`. */
  platformSubdomain?: string
}

/** Default platform subdomain: `dashboard.abugida.com`. */
export const DEFAULT_PLATFORM_SUBDOMAIN = 'dashboard'

/**
 * Normalize a configured base domain into the bare host we append a subdomain
 * to. Accepts the shapes an env var realistically holds (`abugida.com`,
 * `*.abugida.com`, `https://abugida.com/`, `ABUGIDA.COM`) and rejects the ones
 * that would produce nonsense URLs.
 *
 * `localhost` is the one single-label domain allowed: it is what the
 * development deployment uses (`acme.localhost:3000`), and the subdomain model
 * works on it unchanged.
 */
export function normalizeBaseDomain(baseDomain: string): string {
  let value = baseDomain.trim().toLowerCase()
  if (!value) throw new TenantConfigError('baseDomain is required to build a tenant URL.')

  const schemeIndex = value.indexOf('://')
  if (schemeIndex !== -1) value = value.slice(schemeIndex + 3)
  value = value
    .replace(/^\*?\./, '')
    .replace(/\/+$/, '')
    .replace(/\.$/, '')

  const isDomain = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value)
  if (value !== 'localhost' && !isDomain) {
    throw new TenantConfigError(`baseDomain is not a usable domain: “${baseDomain}”.`)
  }
  return value
}

/** `acme.abugida.com` — the host only, with no scheme and no port. */
export function getTenantHostname(slug: string, config: TenantUrlConfig): string {
  const validation = validateTenantSlug(slug)
  if (!validation.ok) throw new TenantSlugError(validation.reason, validation.message)
  return `${validation.slug}.${normalizeBaseDomain(config.baseDomain)}`
}

/**
 * The canonical tenant URL.
 *
 * `getTenantUrl({ slug: 'acme', baseDomain: 'abugida.com' })` →
 * `https://acme.abugida.com`.
 *
 * Throws {@link TenantSlugError} for a slug that is not canonical, so a bad
 * slug is a loud programming error rather than a link to nowhere. Callers that
 * hold user input should validate first (see `validateTenantSlug`).
 */
export function getTenantUrl(options: TenantUrlConfig & { slug: string }): string {
  return buildUrl(getTenantHostname(options.slug, options), options)
}

/**
 * The platform organization-management URL (`dashboard.abugida.com`).
 *
 * This is explicitly *not* a tenant: it is where organizations are created and
 * switched, and it must never be resolved as a workspace.
 */
export function getPlatformUrl(config: TenantUrlConfig): string {
  const subdomain = (config.platformSubdomain ?? DEFAULT_PLATFORM_SUBDOMAIN).trim().toLowerCase()
  if (!subdomain) throw new TenantConfigError('platformSubdomain must not be empty.')
  return buildUrl(`${subdomain}.${normalizeBaseDomain(config.baseDomain)}`, config)
}

function buildUrl(host: string, config: TenantUrlConfig): string {
  const protocol = config.protocol ?? 'https'
  const port =
    config.port === undefined || config.port === null || config.port === ''
      ? ''
      : `:${String(config.port).replace(/^:/, '')}`
  return `${protocol}://${host}${port}`
}
