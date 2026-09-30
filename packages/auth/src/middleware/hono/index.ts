/**
 * @module middleware/hono
 *
 * Hono integration. Two exports:
 *   - `mountAuthRoutes(app, auth)` — mounts better-auth's full request
 *     handler (OAuth sign-in, callback, session, sign-out, email auth, …)
 *     under `auth.config.basePath` (default `/auth`) via a catch-all.
 *   - `requireSession()` — Hono middleware for protecting routes, populating
 *     `c.get("session")` / `c.get("user")` for downstream handlers.
 */

import type { Context, Hono, MiddlewareHandler } from 'hono'
import type { AuthInstance } from '../../core/auth'
import type { ResolvedSession } from '../../core/session'
import { verifyRequestOrigin } from '../../core/csrf'
import { activeOrganizationId, resolveOrganizationAccess } from '../../core/authorize'
import type { OrganizationAccess, OrganizationAccessOptions } from '../../core/authorize'
import { hasAtLeastRole, type PlatformRole } from '../../core/roles'
import { isOpenApiPluginPath, isPasswordlessDisabledPath } from '../../core/routes'

export interface HonoAuthVariables {
  session: ResolvedSession['session'] | null
  user: ResolvedSession['user'] | null
  /** Organization the session is acting in, when the user has picked one. */
  activeOrganizationId: string | null
  /** Present after `requireOrganizationRole` accepted the request. */
  organization: OrganizationAccess | null
}

export interface MountAuthRoutesOptions {
  /**
   * Path prefix better-auth's catch-all handler is mounted under. Defaults to
   * `auth.config.basePath` (itself `/auth` when unset). Must match the
   * `basePath` the auth instance was configured with, so better-auth can
   * resolve its internal endpoints against incoming request paths.
   */
  basePath?: string
  /**
   * Backend-owned policy for `POST {basePath}/sign-in/social`. When set, the
   * endpoint is registered ahead of the catch-all and the client's request
   * body is replaced with one the server builds: the client names a provider
   * and nothing else. Redirect destinations and OAuth options are app
   * configuration, so an untrusted client must not be able to set them.
   *
   * Omit it to serve better-auth's own endpoint unchanged.
   */
  socialSignIn?: SocialSignInPolicy
  /**
   * Add a public provider id to the response of `GET {basePath}/telegram/config`
   * (better-auth reports the internal OIDC provider id, which is not what a
   * client passes to `sign-in/social`). Omit it to serve that endpoint
   * unchanged.
   */
  telegramConfig?: { providerId: string }
}

export interface SocialSignInPolicy {
  /** Where the provider redirects after a successful sign-in. */
  callbackURL: string
  /** Where the provider redirects after a rejected or failed sign-in. */
  errorCallbackURL?: string
  /** Where the provider redirects when the account was just created. */
  newUserCallbackURL?: string
  /**
   * Public provider id → the id better-auth knows it by, e.g.
   * `{ telegram: 'telegram-oidc' }` for Telegram OIDC.
   */
  providerAliases?: Record<string, string>
}

/**
 * Mounts better-auth's request handler (which implements the full OAuth and
 * session flow, i.e. `POST /sign-in/social`, `POST /sign-up/email`,
 * `GET /callback/:provider`, `GET /get-session`, `POST /sign-out`, …) under
 * `auth.config.basePath` (default `/auth`), plus a `/session/refresh`
 * endpoint this package adds for forcing a cache-bypassing session re-check.
 *
 * Optional {@link MountAuthRoutesOptions} narrow two endpoints behind
 * backend-owned policy (see {@link SocialSignInPolicy}); everything else is
 * better-auth's own handler, untouched.
 *
 * @example
 * ```ts
 * const app = new Hono();
 * mountAuthRoutes(app, auth); // better-auth endpoints under /auth/*
 * ```
 */
export function mountAuthRoutes<
  TBindings extends Record<string, unknown> = Record<string, unknown>,
>(
  app: Hono<{ Bindings: TBindings; Variables: HonoAuthVariables }>,
  auth: AuthInstance,
  options: MountAuthRoutesOptions = {},
): void {
  const basePath = options.basePath ?? auth.config.basePath ?? '/auth'

  // Policy wrappers for individual better-auth endpoints. Registered before
  // both `/session/refresh` and the catch-all, or the wildcard would swallow
  // them.
  if (options.socialSignIn) {
    const policy = options.socialSignIn
    app.post(`${basePath}/sign-in/social`, (c) => handleSocialSignIn(c, auth, policy))
  }

  if (options.telegramConfig) {
    const { providerId } = options.telegramConfig
    app.get(`${basePath}/telegram/config`, async (c) => {
      const response = await auth.raw.handler(c.req.raw)
      const body = (await response.json()) as Record<string, unknown>
      return c.json({ provider: providerId, ...body })
    })
  }

  // Register the specific route BEFORE the `/auth/*` catch-all, or Hono's
  // router would match the wildcard first and this endpoint would never run.
  // Not part of better-auth's own handler: forces a fresh (non-cached)
  // session lookup. Useful right after a permission/role change where the
  // 60s cookie cache would otherwise serve stale data.
  app.post(`${basePath}/session/refresh`, async (c) => {
    if (auth.config.cors?.origins) {
      const originCheck = verifyRequestOrigin(c.req.raw, {
        trustedOrigins: auth.config.cors.origins,
      })
      if (!originCheck.ok) {
        return c.json(
          { error: { kind: originCheck.error.kind, message: originCheck.error.message } },
          403,
        )
      }
    }

    const result = await auth.refreshSession(c.req.raw.headers)
    if (!result.ok) {
      return c.json({ error: { kind: result.error.kind, message: result.error.message } }, 401)
    }
    return c.json({ session: result.value.session, user: result.value.user })
  })

  // Two classes of path are refused ahead of the catch-all, which would
  // otherwise serve them:
  //
  //   - better-auth's OpenAPI plugin's own documentation endpoints
  //     (`{basePath}/open-api/*`, `{basePath}/reference`). A consumer
  //     documents the auth surface through `getAuthOpenApiDocument()` and
  //     merges it into its own document, so an unlisted second copy of the
  //     schema would be an undocumented endpoint and a divergent source of
  //     truth.
  //   - the templated password-reset route, which `disabledPaths` cannot
  //     express (it is matched against the resolved request path), so it is
  //     matched by prefix here. See core/routes.ts.
  app.all(`${basePath}/*`, (c: Context) =>
    isOpenApiPluginPath(c.req.path, basePath) || isPasswordlessDisabledPath(c.req.path, basePath)
      ? c.notFound()
      : auth.raw.handler(c.req.raw),
  )

  app.on(['GET', 'POST'], `${basePath}/*`, (c: Context) => auth.raw.handler(c.req.raw))
}

/**
 * `POST {basePath}/sign-in/social` behind a {@link SocialSignInPolicy}.
 *
 * The client's body is consumed and replaced with one this package builds, so
 * only the provider is client-controlled: redirect destinations and OAuth
 * options are app configuration, and honouring them from the request would let
 * a caller redirect a freshly created session to a host of their choosing.
 *
 * The rebuilt request is a plain `Request` rather than a re-dispatched Hono
 * one, so the JSON body is available to better-auth exactly once.
 */
function handleSocialSignIn(
  c: Context,
  auth: AuthInstance,
  policy: SocialSignInPolicy,
): Response | Promise<Response> {
  const body = (c.req.raw as Request)
    .clone()
    .json()
    .catch(() => null) as Promise<{ provider?: unknown } | null>

  return body.then((parsed) => {
    const requested = parsed?.provider
    if (typeof requested !== 'string' || requested === '') {
      return c.json(
        {
          error: { kind: 'provider_error', message: 'A social provider is required to sign in.' },
        },
        400,
      )
    }

    const provider = policy.providerAliases?.[requested] ?? requested
    const serverBody = {
      provider,
      callbackURL: policy.callbackURL,
      ...(policy.errorCallbackURL ? { errorCallbackURL: policy.errorCallbackURL } : {}),
      ...(policy.newUserCallbackURL ? { newUserCallbackURL: policy.newUserCallbackURL } : {}),
      disableRedirect: true,
    }

    return auth.raw.handler(
      new Request(c.req.raw.url, {
        method: c.req.raw.method,
        headers: c.req.raw.headers,
        body: JSON.stringify(serverBody),
      }),
    )
  })
}

/**
 * Defense-in-depth CSRF middleware for state-changing routes that don't go
 * through better-auth's own OAuth redirect flow (which already carries
 * PKCE/state protection). Rejects mutating requests whose Origin/Referer
 * isn't in `auth.config.cors.origins`. Apply to your own mutating routes
 * that sit behind `requireSession` — not required on `mountAuthRoutes`
 * itself, which already applies it to `/session/refresh`.
 *
 * @example
 * ```ts
 * app.post("/account/delete", csrfProtection(auth), requireSession(auth), handler);
 * ```
 */
export function csrfProtection(auth: AuthInstance): MiddlewareHandler {
  return async (c, next) => {
    const trustedOrigins = auth.config.cors?.origins
    if (trustedOrigins && trustedOrigins.length > 0) {
      const result = verifyRequestOrigin(c.req.raw, { trustedOrigins })
      if (!result.ok) {
        auth.logger.warn('Blocked request failing origin check', {
          path: c.req.path,
          method: c.req.method,
        })
        return c.json({ error: { kind: result.error.kind, message: result.error.message } }, 403)
      }
    }
    return next()
  }
}

/**
 * Middleware that resolves the session for every request and stores it on
 * context, WITHOUT rejecting unauthenticated requests. Useful for routes
 * that behave differently when logged in vs. anonymous.
 */
export function withSession(
  auth: AuthInstance,
): MiddlewareHandler<{ Variables: HonoAuthVariables }> {
  return async (c, next) => {
    const result = await auth.getSession(c.req.raw.headers)
    if (result.ok) {
      c.set('session', result.value.session)
      c.set('user', result.value.user)
      c.set('activeOrganizationId', activeOrganizationId(result.value))
    } else {
      c.set('session', null)
      c.set('user', null)
      c.set('activeOrganizationId', null)
    }
    await next()
  }
}

export interface RequireOrganizationRoleOptions extends OrganizationAccessOptions {
  /** Minimum platform role required to perform the operation. */
  minimumRole: PlatformRole
  /**
   * Where to read the target organization from. Defaults to the session's
   * active organization; pass a param/header resolver for routes scoped by
   * `:organizationId`.
   */
  resolveOrganizationId?: (c: Context) => string | undefined
}

/**
 * Rejects requests the caller may not perform on the target organization
 * (401/403 JSON), and publishes the resolved membership on
 * `c.get("organization")`.
 *
 * The organization id is always checked against the caller's own membership
 * rows, so a signed-in user cannot reach another organization's data by
 * passing someone else's id.
 *
 * @example
 * ```ts
 * app.get("/organizations/:organizationId/revenue",
 *   requireSession(auth),
 *   requireOrganizationRole(auth, {
 *     minimumRole: "admin",
 *     resolveOrganizationId: (c) => c.req.param("organizationId"),
 *   }),
 *   handler);
 * ```
 */
export function requireOrganizationRole(
  auth: AuthInstance,
  options: RequireOrganizationRoleOptions,
): MiddlewareHandler<{ Variables: HonoAuthVariables }> {
  return async (c, next) => {
    const sessionResult = await auth.getSession(c.req.raw.headers)
    const session = sessionResult.ok ? sessionResult.value : null

    const target = options.resolveOrganizationId
      ? options.resolveOrganizationId(c)
      : options.organizationId

    const access = await resolveOrganizationAccess(auth.db, session, {
      ...(target ? { organizationId: target } : {}),
    })

    if (!access.ok) {
      auth.logger.debug('Rejected unauthorized organization request', {
        path: c.req.path,
        kind: access.error.kind,
      })
      c.set('organization', null)
      return c.json(
        { error: { kind: access.error.kind, message: access.error.message } },
        access.error.kind === 'unauthorized' ? 401 : 403,
      )
    }

    if (!hasAtLeastRole(access.value.platformRole, options.minimumRole)) {
      c.set('organization', null)
      return c.json(
        {
          error: {
            kind: 'forbidden',
            message: `This action requires the ${options.minimumRole} role.`,
          },
        },
        403,
      )
    }

    c.set('organization', access.value)
    return next()
  }
}

/**
 * Middleware that rejects requests without a valid session (401 JSON).
 * Compose after `withSession` isn't required — this resolves the session
 * itself if it hasn't already been set on context.
 */
export function requireSession(
  auth: AuthInstance,
): MiddlewareHandler<{ Variables: HonoAuthVariables }> {
  return async (c, next) => {
    let session = c.get('session')
    let user = c.get('user')

    if (!session || !user) {
      const result = await auth.getSession(c.req.raw.headers)
      if (!result.ok) {
        auth.logger.debug('Rejected unauthenticated request', {
          path: c.req.path,
          kind: result.error.kind,
        })
        return c.json({ error: { kind: result.error.kind, message: result.error.message } }, 401)
      }
      session = result.value.session
      user = result.value.user
      c.set('session', session)
      c.set('user', user)
    }

    return next()
  }
}
