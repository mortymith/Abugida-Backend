/**
 * @module middleware/hono
 *
 * The API's tenant middleware. Two middlewares, mounted in this order:
 *
 *   1. `tenantHostMiddleware(config)` — resolves the request hostname once and
 *      puts the outcome on the context. Pure: no session, no database, so it
 *      can run on every request including anonymous ones.
 *   2. `requireTenantContextMiddleware({ store })` — for tenant-scoped routes:
 *      when the request arrived on a tenant host it requires a session, a
 *      tenant and a membership, and publishes a `TenantContext` handlers read
 *      instead of resolving tenancy themselves.
 *
 *   request → auth → hostname → tenant lookup → membership → TenantContext
 *
 * A request on a *platform* host (`dashboard`, `api`, `www`, the apex) is not a
 * tenant request and passes through with a null context; tenant-scoped routes
 * then reject it. Nothing here decides authorization on its own — that is
 * `@abugida/tenant/authorization` at the handler.
 */

import type { MiddlewareHandler } from 'hono'
import type { HonoAuthVariables } from '@abugida/auth/hono'
import { requireTenantContextBySlug } from '../authorization'
import type { TenantContext, TenantStore } from '../context'
import { TenantMembershipError, TenantNotFoundError, TenantUnauthenticatedError } from '../errors'
import { resolveTenantFromHostname } from '../resolve'
import type { TenantDomainConfig, TenantHostResolution } from '../resolve'

/** The variables this package writes onto a Hono context. */
export interface TenantVariables {
  /** What the request hostname turned out to be. `null` when unresolvable. */
  tenantHost: TenantHostResolution | null
  /** The authorized tenant scope, or `null` outside a tenant request. */
  tenant: TenantContext | null
}

export type TenantEnv = { Bindings: object; Variables: HonoAuthVariables & TenantVariables }

/** RFC 9457-lite error body, matching the API's other problem responses. */
function problem(status: number, code: string, detail: string, typeBaseUrl: string): Response {
  return Response.json(
    { type: `${typeBaseUrl.replace(/\/$/, '')}/${code}`, title: code, status, detail },
    { status, headers: { 'content-type': 'application/problem+json' } },
  )
}

/**
 * Resolve the hostname onto the context. Never rejects: a host that is not a
 * tenant, or not parseable, is a `tenantHost` of kind `platform`, `apex`,
 * `external` or `invalid`, and it is the route's choice what that means.
 */
export function tenantHostMiddleware(config: TenantDomainConfig): MiddlewareHandler<TenantEnv> {
  return async (c, next) => {
    const hostname = c.req.header('host') ?? c.req.header('x-forwarded-host') ?? null
    c.set('tenantHost', resolveTenantFromHostname(hostname, config))
    await next()
  }
}

export interface RequireTenantContextOptions {
  store: TenantStore
  /**
   * When true, a request that did not arrive on a tenant host is rejected with
   * 404 instead of passing through with a null context. Use it on routes that
   * only exist inside a workspace.
   */
  requireTenantHost?: boolean
  /** Base for the `type` field of problem responses (the API's `ERROR_BASE_URL`). */
  errorTypeBaseUrl?: string
}

/**
 * Publish `c.get('tenant')` for tenant-scoped routes.
 *
 * Status codes are chosen so the distinctions survive: 404 unknown workspace,
 * 401 no session, 403 authenticated but not a member — the cross-tenant case.
 */
export function requireTenantContextMiddleware(
  options: RequireTenantContextOptions,
): MiddlewareHandler<TenantEnv> {
  const { store, requireTenantHost = false } = options
  const typeBaseUrl = options.errorTypeBaseUrl ?? 'https://abugida.com/errors'

  return async (c, next) => {
    const host = c.get('tenantHost') ?? null

    if (!host || host.kind !== 'tenant') {
      c.set('tenant', null)
      if (requireTenantHost) {
        return problem(
          404,
          'tenant_host_required',
          'This endpoint is only available on a tenant subdomain.',
          typeBaseUrl,
        )
      }
      return next()
    }

    const userId = c.get('user')?.id ?? null
    if (!userId) {
      return problem(401, 'tenant_unauthenticated', 'Sign in to open this workspace.', typeBaseUrl)
    }

    try {
      c.set('tenant', await requireTenantContextBySlug({ store, slug: host.slug, userId }))
    } catch (cause) {
      if (cause instanceof TenantNotFoundError) {
        return problem(404, cause.code, cause.message, typeBaseUrl)
      }
      if (cause instanceof TenantUnauthenticatedError) {
        return problem(401, cause.code, cause.message, typeBaseUrl)
      }
      if (cause instanceof TenantMembershipError) {
        return problem(403, cause.code, cause.message, typeBaseUrl)
      }
      throw cause
    }

    return next()
  }
}

/**
 * Read the tenant context a handler is scoped to.
 *
 * Throws when the handler is running on a non-tenant host, so a route that
 * forgot to mount the middleware fails loudly instead of reading rows with an
 * undefined tenant.
 */
export function requireTenant(c: { get: (key: 'tenant') => TenantContext | null }): TenantContext {
  const tenant = c.get('tenant')
  if (!tenant) {
    throw new TenantNotFoundError('No tenant context on this request.')
  }
  return tenant
}
