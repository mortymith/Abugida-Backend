/**
 * @module config/env
 *
 * The environment contract for tenancy, owned by this package for the same
 * reason `@abugida/auth` owns `authEnvShape`: the base domain is a deployment
 * fact, and the API and the dashboard must not be able to disagree about it.
 *
 * Apps spread {@link tenantEnvShape} into their own zod object and project the
 * parsed values with {@link resolveTenantConfig}.
 */

import { z } from 'zod'
import type { TenantDomainConfig } from '../resolve'
import { DEFAULT_PLATFORM_SUBDOMAIN } from '../url'

/** The tenant-related environment keys, as a raw zod shape. */
export const tenantEnvShape = {
  // ── Tenant domain ───────────────────────────────────────────────────────
  /** Domain tenant workspaces are served from. Development: `localhost`. */
  TENANT_BASE_DOMAIN: z.string().min(1, 'TENANT_BASE_DOMAIN is required.').default('abugida.com'),
  /** Scheme used when building tenant URLs. Development: `http`. */
  TENANT_PROTOCOL: z.enum(['http', 'https']).default('https'),
  /**
   * Port appended to built tenant URLs. Only for local development, where the
   * dashboard is not on the default port (`acme.localhost:3000`).
   */
  TENANT_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  /** Subdomain serving the platform surface (organization management). */
  TENANT_PLATFORM_SUBDOMAIN: z.string().min(1).default(DEFAULT_PLATFORM_SUBDOMAIN),
} satisfies z.ZodRawShape

/** The parsed form of {@link tenantEnvShape}. */
export type TenantEnv = z.output<z.ZodObject<typeof tenantEnvShape>>

/**
 * Project an app's parsed environment onto the configuration the resolver and
 * URL builders take.
 *
 * This is the only place an app turns environment variables into tenancy
 * policy; nothing downstream reads `process.env`.
 */
export function resolveTenantConfig(env: TenantEnv): TenantDomainConfig {
  return {
    baseDomain: env.TENANT_BASE_DOMAIN,
    protocol: env.TENANT_PROTOCOL,
    ...(env.TENANT_PORT !== undefined ? { port: env.TENANT_PORT } : {}),
    platformSubdomain: env.TENANT_PLATFORM_SUBDOMAIN,
  }
}
