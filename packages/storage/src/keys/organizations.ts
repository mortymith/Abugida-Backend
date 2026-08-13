/**
 * Organization-related storage key generators.
 *
 * Key structure:
 * ```
 * organizations/{orgId}/logo.{ext}
 * organizations/{orgId}/banners/{assetId}
 * ```
 */

/** Generate the base key for an organization directory. */
export function organization(orgId: string): string {
  return `organizations/${orgId}`
}

/** Generate the key for an organization logo. */
export function organizationLogo(orgId: string, ext = 'webp'): string {
  return `organizations/${orgId}/logo.${ext}`
}

/** Generate the key for an organization banner. */
export function organizationBanner(orgId: string, assetId: string): string {
  return `organizations/${orgId}/banners/${assetId}`
}

/** List prefix for all banners of an organization. */
export function organizationBannersPrefix(orgId: string): string {
  return `organizations/${orgId}/banners/`
}
