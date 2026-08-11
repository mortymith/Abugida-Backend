/**
 * @module core/token-refresh
 *
 * Wraps better-auth's account/access-token API so consumers who need to call
 * a provider's API on the user's behalf (e.g. reading a Google Calendar, or
 * calling back into Apple) get a valid, non-expired access token without
 * reimplementing OAuth refresh themselves.
 *
 * better-auth already persists the `refreshToken` it receives on sign-in
 * (see `account.refreshToken` in the injected schema) and knows how to
 * exchange it for a fresh `accessToken` per-provider. This module is a thin,
 * typed, logged wrapper around that so the refresh flow is consistent
 * between Hono and TanStack call sites.
 */

import type { Auth } from "better-auth";
import type { AuthResult } from "./types";
import { ok, err } from "./types";
import { noopLogger, type Logger } from "./logger";

export interface GetAccessTokenParams {
  userId: string;
  /** Provider id as configured, e.g. "google" or "apple". */
  providerId: string;
}

export interface AccessTokenResult {
  accessToken: string;
  /** undefined if the provider/response didn't include an expiry. */
  expiresAt: Date | undefined;
}

/**
 * Returns a valid access token for the given user + provider, transparently
 * refreshing it via the stored refresh token if the cached one is expired
 * or close to expiring. Never logs the token itself — only provider id,
 * user id, and whether a refresh occurred.
 *
 * @example
 * ```ts
 * const result = await getValidAccessToken(auth.raw, { userId, providerId: "google" });
 * if (result.ok) {
 *   await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
 *     headers: { Authorization: `Bearer ${result.value.accessToken}` },
 *   });
 * }
 * ```
 */
export async function getValidAccessToken(
  auth: Auth,
  params: GetAccessTokenParams,
  logger: Logger = noopLogger
): Promise<AuthResult<AccessTokenResult>> {
  try {
    // better-auth's account plugin exposes `getAccessToken`, which checks
    // the stored token's expiry and performs the provider's refresh-token
    // exchange automatically when needed, persisting the rotated token.
    const result = await auth.api.getAccessToken({
      body: { providerId: params.providerId, userId: params.userId },
    });

    if (!result?.accessToken) {
      logger.warn("No access token available for provider", { providerId: params.providerId, userId: params.userId });
      return err({
        kind: "provider_error",
        providerId: params.providerId,
        message: "No linked account found, or the provider did not return an access token.",
      });
    }

    logger.debug("Access token resolved", { providerId: params.providerId, userId: params.userId });

    return ok({
      accessToken: result.accessToken,
      expiresAt: result.accessTokenExpiresAt ? new Date(result.accessTokenExpiresAt) : undefined,
    });
  } catch (cause) {
    logger.error("Access token refresh failed", {
      providerId: params.providerId,
      userId: params.userId,
      message: cause instanceof Error ? cause.message : "unknown",
    });
    return err({
      kind: "provider_error",
      providerId: params.providerId,
      message: "Failed to refresh the provider access token. The user may need to reconnect this account.",
      cause,
    });
  }
}
