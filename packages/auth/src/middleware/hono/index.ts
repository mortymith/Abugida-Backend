/**
 * @module middleware/hono
 *
 * Hono integration. Two exports:
 *   - `mountAuthRoutes(app, auth)` — mounts /auth/login, /auth/callback,
 *     /auth/logout (and the rest of better-auth's handler) under one prefix.
 *   - `requireSession()` — Hono middleware for protecting routes, populating
 *     `c.get("session")` / `c.get("user")` for downstream handlers.
 */

import type { Context, Hono, MiddlewareHandler } from "hono";
import type { AuthInstance } from "../../core/auth";
import type { ResolvedSession } from "../../core/session";
import { verifyRequestOrigin } from "../../core/csrf";

export interface HonoAuthVariables {
  session: ResolvedSession["session"] | null;
  user: ResolvedSession["user"] | null;
}

export interface MountAuthRoutesOptions {
  /** Path prefix better-auth's catch-all handler is mounted under. Default "/auth". */
  basePath?: string;
}

/**
 * Mounts better-auth's request handler (which implements the full OAuth
 * flow, i.e. GET/POST /auth/login, /auth/callback, /auth/logout, session
 * endpoints, etc.) onto a Hono app, plus a `/session/refresh` endpoint this
 * package adds for forcing a cache-bypassing session re-check.
 *
 * @example
 * ```ts
 * const app = new Hono();
 * mountAuthRoutes(app, auth);
 * ```
 */
export function mountAuthRoutes<TBindings extends Record<string, unknown> = Record<string, unknown>>(
  app: Hono<{ Bindings: TBindings; Variables: HonoAuthVariables }>,
  auth: AuthInstance,
  options: MountAuthRoutesOptions = {}
): void {
  const basePath = options.basePath ?? "/auth";

  // Register the specific route BEFORE the `/auth/*` catch-all, or Hono's
  // router would match the wildcard first and this endpoint would never run.
  // Not part of better-auth's own handler: forces a fresh (non-cached)
  // session lookup. Useful right after a permission/role change where the
  // 60s cookie cache would otherwise serve stale data.
  app.post(`${basePath}/session/refresh`, async (c) => {
    if (auth.config.cors?.origins) {
      const originCheck = verifyRequestOrigin(c.req.raw, { trustedOrigins: auth.config.cors.origins });
      if (!originCheck.ok) {
        return c.json({ error: { kind: originCheck.error.kind, message: originCheck.error.message } }, 403);
      }
    }

    const result = await auth.refreshSession(c.req.raw.headers);
    if (!result.ok) {
      return c.json({ error: { kind: result.error.kind, message: result.error.message } }, 401);
    }
    return c.json({ session: result.value.session, user: result.value.user });
  });

  app.on(["GET", "POST"], `${basePath}/*`, (c: Context) => auth.raw.handler(c.req.raw));
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
    const trustedOrigins = auth.config.cors?.origins;
    if (trustedOrigins && trustedOrigins.length > 0) {
      const result = verifyRequestOrigin(c.req.raw, { trustedOrigins });
      if (!result.ok) {
        auth.logger.warn("Blocked request failing origin check", { path: c.req.path, method: c.req.method });
        return c.json({ error: { kind: result.error.kind, message: result.error.message } }, 403);
      }
    }
    await next();
  };
}

/**
 * Middleware that resolves the session for every request and stores it on
 * context, WITHOUT rejecting unauthenticated requests. Useful for routes
 * that behave differently when logged in vs. anonymous.
 */
export function withSession(auth: AuthInstance): MiddlewareHandler<{ Variables: HonoAuthVariables }> {
  return async (c, next) => {
    const result = await auth.getSession(c.req.raw.headers);
    if (result.ok) {
      c.set("session", result.value.session);
      c.set("user", result.value.user);
    } else {
      c.set("session", null);
      c.set("user", null);
    }
    await next();
  };
}

/**
 * Middleware that rejects requests without a valid session (401 JSON).
 * Compose after `withSession` isn't required — this resolves the session
 * itself if it hasn't already been set on context.
 */
export function requireSession(auth: AuthInstance): MiddlewareHandler<{ Variables: HonoAuthVariables }> {
  return async (c, next) => {
    let session = c.get("session");
    let user = c.get("user");

    if (!session || !user) {
      const result = await auth.getSession(c.req.raw.headers);
      if (!result.ok) {
        auth.logger.debug("Rejected unauthenticated request", { path: c.req.path, kind: result.error.kind });
        return c.json({ error: { kind: result.error.kind, message: result.error.message } }, 401);
      }
      session = result.value.session;
      user = result.value.user;
      c.set("session", session);
      c.set("user", user);
    }

    await next();
  };
}
