/**
 * @module core/csrf
 *
 * better-auth already generates and verifies PKCE/state parameters for the
 * OAuth redirect itself, which is the primary CSRF defense for the
 * login/callback flow. This module adds a second, independent layer for
 * *other* state-changing auth endpoints (logout, session refresh, account
 * unlink) that don't go through the OAuth redirect: a same-origin check
 * against `Origin`/`Referer`, the standard defense-in-depth measure
 * recommended by OWASP for cookie-authenticated POST/DELETE requests.
 *
 * This is intentionally simple (allowlist compare, not a token scheme) —
 * it does not replace better-auth's own CSRF handling, it backstops it.
 */

import type { AuthResult } from "./types";
import { ok, err } from "./types";

export interface OriginCheckOptions {
  /** Allowed origins, e.g. config.cors.origins. Exact match, scheme included. */
  trustedOrigins: string[];
  /** HTTP methods this check applies to. Default: mutating methods only. */
  methods?: string[];
}

const DEFAULT_PROTECTED_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * Verifies that a state-changing request's `Origin` header (falling back to
 * `Referer`'s origin) is in the trusted-origins allowlist. Safe methods
 * (GET/HEAD/OPTIONS) are always allowed through untouched, since they must
 * not have side effects per HTTP semantics.
 */
export function verifyRequestOrigin(
  request: { method: string; headers: Headers },
  options: OriginCheckOptions
): AuthResult<true> {
  const protectedMethods = options.methods ?? DEFAULT_PROTECTED_METHODS;

  if (!protectedMethods.includes(request.method.toUpperCase())) {
    return ok(true as const);
  }

  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");
  const candidate = originHeader ?? (refererHeader ? safeOriginFromUrl(refererHeader) : null);

  if (!candidate) {
    return err({ kind: "csrf_mismatch", message: "Missing Origin/Referer header on a state-changing request." });
  }

  if (!options.trustedOrigins.includes(candidate)) {
    return err({ kind: "csrf_mismatch", message: "Request origin is not in the trusted origins allowlist." });
  }

  return ok(true as const);
}

function safeOriginFromUrl(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
