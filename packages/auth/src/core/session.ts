/**
 * @module core/session
 *
 * Thin, framework-agnostic wrapper around better-auth's session API. Keeping
 * this here (instead of calling `auth.api.getSession` directly all over the
 * codebase) is what lets both the Hono middleware and TanStack server
 * functions share identical session-resolution and error semantics.
 */

import type { Auth } from "better-auth";
import type { AuthResult } from "./types";
import { ok, err } from "./types";
import { noopLogger, redact, type Logger } from "./logger";

export interface ResolvedSession {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
  user: {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
    image: string | null;
  };
}

/**
 * Resolves a session from raw request headers (works for both a Hono
 * `c.req.raw.headers` and a TanStack Start server-function request).
 * Returns a discriminated AuthResult instead of throwing, so callers decide
 * how to respond (redirect, 401 JSON, etc).
 */
export async function resolveSession(
  auth: Auth,
  headers: Headers,
  options: { logger?: Logger; disableCookieCache?: boolean } = {}
): Promise<AuthResult<ResolvedSession>> {
  const logger = options.logger ?? noopLogger;

  try {
    const result = await auth.api.getSession({
      headers,
      query: options.disableCookieCache ? { disableCookieCache: true } : undefined,
    });

    if (!result?.session || !result?.user) {
      logger.debug("No active session found for request");
      return err({ kind: "unauthorized", message: "No active session." });
    }

    if (new Date(result.session.expiresAt).getTime() < Date.now()) {
      logger.info("Session expired", redact({ sessionId: result.session.id, userId: result.session.userId }));
      return err({ kind: "session_expired", message: "Session has expired. Please sign in again." });
    }

    logger.debug("Session resolved", { sessionId: result.session.id, userId: result.session.userId });

    return ok({
      session: {
        id: result.session.id,
        userId: result.session.userId,
        expiresAt: new Date(result.session.expiresAt),
      },
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name ?? null,
        emailVerified: result.user.emailVerified ?? false,
        image: result.user.image ?? null,
      },
    });
  } catch (cause) {
    logger.error("Session resolution threw", { message: cause instanceof Error ? cause.message : "unknown" });
    return err({ kind: "session_invalid", message: "Could not validate session.", cause });
  }
}

/**
 * Forces a fresh session lookup that bypasses better-auth's short-lived
 * cookie cache. Use sparingly (e.g. right after a privilege change) — most
 * calls should use `resolveSession` so hot paths stay cheap.
 */
export function refreshSession(auth: Auth, headers: Headers, logger?: Logger): Promise<AuthResult<ResolvedSession>> {
  return resolveSession(auth, headers, { logger, disableCookieCache: true });
}

/** Revokes the current session (used by /auth/logout across both frameworks). */
export async function revokeSession(
  auth: Auth,
  headers: Headers,
  logger: Logger = noopLogger
): Promise<AuthResult<true>> {
  try {
    await auth.api.signOut({ headers });
    logger.info("Session revoked");
    return ok(true as const);
  } catch (cause) {
    logger.error("Sign-out failed", { message: cause instanceof Error ? cause.message : "unknown" });
    return err({ kind: "unknown", message: "Failed to sign out.", cause });
  }
}
