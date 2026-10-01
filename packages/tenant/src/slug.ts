/**
 * @module slug
 *
 * The one place a tenant slug is defined. A slug *is* a DNS label — it is the
 * subdomain a tenant workspace is served from (`acme.abugida.com`) — so the
 * rules are deliberately boring: lowercase alphanumerics and single hyphens,
 * 3–63 characters, never a reserved platform name.
 *
 * Two entry points, and the difference matters:
 *
 *   - {@link normalizeTenantSlug} *changes* a value. It is for input the user
 *     typed (a workspace name, a form field).
 *   - {@link validateTenantSlug} *judges* a value. It never rewrites, so a
 *     request that resolves a hostname cannot silently re-point an existing
 *     tenant at a different identity: `acme` and `ACME` are different strings,
 *     and only the canonical one resolves.
 */

/** Shortest accepted slug. */
export const TENANT_SLUG_MIN_LENGTH = 3

/**
 * Longest accepted slug — the DNS label limit. A subdomain longer than this
 * cannot be served, so accepting one would create a workspace nobody can reach.
 */
export const TENANT_SLUG_MAX_LENGTH = 63

/**
 * Subdomains the platform owns. Kept here, in one list, because they are a
 * routing fact (Caddy serves them, the Caddyfile in `docker/config/caddy`
 * routes them) and a registration fact (an organization may not claim them) at
 * the same time. A name that is reserved must fail server-side, not just in the
 * sign-up form.
 *
 * Sources: the `DOMAIN_*` hosts the shared Caddyfile routes, the compose
 * services, plus the generic names that would shadow the platform.
 */
export const RESERVED_TENANT_SLUGS = [
  // Platform surfaces
  'www',
  'dashboard',
  'admin',
  'app',
  'api',
  'auth',
  'docs',
  'marketing',
  // Static delivery
  'assets',
  'cdn',
  'static',
  'media',
  'files',
  // Infrastructure hosts the Caddyfile routes
  'sync',
  'signoz',
  'minio',
  'grafana',
  'caddy',
  'otel',
  'vault',
  'redis',
  // Environments & previews
  'dev',
  'development',
  'staging',
  'stage',
  'prod',
  'production',
  'preview',
  'test',
  'testing',
  'beta',
  'sandbox',
  'demo',
  'localhost',
  // Support / comms
  'support',
  'help',
  'status',
  'blog',
  'mail',
  'smtp',
  'imap',
  'email',
  'news',
  'careers',
  'legal',
  'about',
] as const

export type ReservedTenantSlug = (typeof RESERVED_TENANT_SLUGS)[number]

const RESERVED = new Set<string>(RESERVED_TENANT_SLUGS)

/**
 * A canonical slug: alphanumeric ends, single hyphens between, nothing else.
 * Written as a pattern rather than a rule list so the "no doubled separator"
 * decision is visible in one place.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Why a slug was rejected. Stable, so forms and logs can branch on it. */
export type TenantSlugFailure = 'empty' | 'too_short' | 'too_long' | 'invalid_format' | 'reserved'

export type TenantSlugValidation =
  { ok: true; slug: string } | { ok: false; reason: TenantSlugFailure; message: string }

/**
 * Whether `slug` is a platform-reserved name. Case-insensitive, because a
 * reserved name is reserved whatever case it was typed in.
 */
export function isReservedTenantSlug(slug: string): boolean {
  return RESERVED.has(slug.trim().toLowerCase())
}

/**
 * Fold arbitrary text into a candidate slug: lowercase, ASCII, words joined by
 * single hyphens, no leading/trailing hyphen, inside the DNS length limit.
 *
 * Note that normalization does not make a name *valid* — `normalizeTenantSlug`
 * returns the best candidate it can, and {@link validateTenantSlug} still has
 * the last word (notably on length, and on reserved names).
 */
export function normalizeTenantSlug(input: string): string {
  return (
    input
      .normalize('NFKD')
      .toLowerCase()
      // Anything that is not a slug character becomes a separator; collapsing the
      // run means `A / B` and `A//B` both land on `a-b`.
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, TENANT_SLUG_MAX_LENGTH)
      // Truncation can expose a trailing hyphen (`abc-` from a longer name).
      .replace(/-+$/g, '')
  )
}

/**
 * Derive a slug candidate from a display name. Thin alias over
 * {@link normalizeTenantSlug}, kept because form code reads better with it and
 * because it documents the intent (name → URL) rather than the mechanism.
 */
export function slugFromTenantName(name: string): string {
  return normalizeTenantSlug(name)
}

/**
 * Judge a slug without changing it.
 *
 * Rejects anything that is not already canonical, which is what makes it safe
 * to use on the request path: an uppercase or padded value fails instead of
 * being quietly rewritten into some other tenant's identity.
 */
export function validateTenantSlug(slug: string): TenantSlugValidation {
  if (slug.length === 0) {
    return { ok: false, reason: 'empty', message: 'Subdomain is required.' }
  }
  if (slug.length < TENANT_SLUG_MIN_LENGTH) {
    return {
      ok: false,
      reason: 'too_short',
      message: `Subdomain must be at least ${TENANT_SLUG_MIN_LENGTH} characters`,
    }
  }
  if (slug.length > TENANT_SLUG_MAX_LENGTH) {
    return {
      ok: false,
      reason: 'too_long',
      message: `Subdomain must be at most ${TENANT_SLUG_MAX_LENGTH} characters`,
    }
  }
  if (!SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      reason: 'invalid_format',
      message: 'Subdomain can only contain lowercase letters, numbers, and single hyphens',
    }
  }
  if (isReservedTenantSlug(slug)) {
    return {
      ok: false,
      reason: 'reserved',
      message: `“${slug}” is reserved by Abugida. Choose another subdomain.`,
    }
  }
  return { ok: true, slug }
}

/** Convenience predicate over {@link validateTenantSlug}. */
export function isValidTenantSlug(slug: string): boolean {
  return validateTenantSlug(slug).ok
}
